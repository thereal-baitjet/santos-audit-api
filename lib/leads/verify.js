// Email verification for the verified-email free tier (widget audit, and the
// Phase C llms.txt demo). Flow: requestCode emails a 6-digit code (only its
// sha256 hash is stored, with a 10-minute expiry); confirmCode checks it in
// constant time, stamps the lead verified, and returns a 30-day signed token;
// verifyToken gates the free endpoints.
//
// Rate limits (3 code requests per email per hour, 10 per IP per hour) reuse
// the demo-limit adapters. demo_claims stores only key + expires_at — no
// counters — so a fixed-window "N per hour" limit is emulated with N slot
// keys per window: the caller tries slots 1..N for the current hour block and
// consumes the first free one; all slots taken means the limit is hit. Like
// the rest of the limiter this fails open on storage outage.
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { claimKey, hashIdentity } from "../demo-limit.js";
import { sendVerificationEmail } from "../email/resend.js";
import { upsertLeadCode, getLeadByEmail, markLeadVerified } from "./store.js";

const TOKEN_SECRET = process.env.REPORT_ACCESS_TOKEN_SECRET ?? "dev-only-report-token-secret";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_TTL_SECS = 30 * 24 * 3600; // 30 days
const EMAIL_CODES_PER_HOUR = 3;
const IP_CODES_PER_HOUR = 10;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hourBlock = () => Math.floor(Date.now() / 3_600_000);

// Consume one of `limit` fixed-window slots; false when the window is full.
async function consumeSlot(prefix, limit) {
  const window = hourBlock();
  for (let slot = 1; slot <= limit; slot++) {
    if (await claimKey(`${prefix}:${window}:${slot}`, 3600)) return true;
  }
  return false;
}

function signToken(email, expSeconds) {
  const mac = createHmac("sha256", TOKEN_SECRET).update(`${email}.${expSeconds}`).digest("base64url");
  return `${Buffer.from(email).toString("base64url")}.${Buffer.from(String(expSeconds)).toString("base64url")}.${mac}`;
}

// Send a fresh 6-digit code. Rate-limited requests resolve { ok:true,
// sent:false } so the route never reveals a limit was hit; a genuine delivery
// failure resolves { ok:false, code:"EMAIL_DELIVERY_FAILED" } — a silent ok
// there strands the user waiting for an email that will never come. dev_code
// is included only in non-production without a Resend key (local testing).
export async function requestCode({ email, targetUrl, source, ip }) {
  const emailOk = await consumeSlot(`verify:email:${hashIdentity(email)}`, EMAIL_CODES_PER_HOUR);
  const ipOk = ip ? await consumeSlot(`verify:ip:${hashIdentity(ip)}`, IP_CODES_PER_HOUR) : true;
  if (!emailOk || !ipOk) return { ok: true, sent: false };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await upsertLeadCode({
    email,
    targetUrl,
    source,
    codeHash: sha256(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  // Local testing without a Resend key: hand the code back directly.
  if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY && !process.env.RESEND_API) {
    return { ok: true, sent: false, dev_code: code };
  }
  const sent = await sendVerificationEmail({ to: email, code });
  if (!sent.ok) {
    return { ok: false, code: "EMAIL_DELIVERY_FAILED", reason: sent.reason };
  }
  return { ok: true, sent: true };
}

// Check a code. Returns { ok:true, token } or { ok:false, code } where code
// is "INVALID_CODE" (400) or "CODE_EXPIRED" (410).
export async function confirmCode({ email, code }) {
  const lead = await getLeadByEmail(email);
  if (!lead?.verify_code_hash) return { ok: false, code: "INVALID_CODE" };

  const digest = Buffer.from(sha256(String(code).trim()), "utf8");
  const stored = Buffer.from(String(lead.verify_code_hash), "utf8");
  if (digest.length !== stored.length || !timingSafeEqual(digest, stored)) {
    return { ok: false, code: "INVALID_CODE" };
  }
  if (!lead.verify_expires_at || new Date(lead.verify_expires_at) <= new Date()) {
    return { ok: false, code: "CODE_EXPIRED" };
  }

  await markLeadVerified(email);
  return { ok: true, token: signToken(email, Math.floor(Date.now() / 1000) + TOKEN_TTL_SECS) };
}

// Validate a signed token. Returns the verified email, or null when the
// signature, expiry, or backing lead row check fails.
export async function verifyToken(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  let email, expSeconds;
  try {
    email = Buffer.from(parts[0], "base64url").toString("utf8");
    expSeconds = Number(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!email || !Number.isFinite(expSeconds)) return null;

  const expected = Buffer.from(
    createHmac("sha256", TOKEN_SECRET).update(`${email}.${expSeconds}`).digest("base64url"),
    "utf8"
  );
  const given = Buffer.from(parts[2], "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (expSeconds * 1000 <= Date.now()) return null;

  const lead = await getLeadByEmail(email);
  if (!lead?.verified_at) return null;
  return email;
}
