// Unguessable public IDs + stateless retrieval-token auth for deep-audit jobs.
// Job IDs alone are never authorization: every read requires the access token
// minted at create time (HMAC over the job id — nothing to store or leak).
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.REPORT_ACCESS_TOKEN_SECRET ?? "dev-only-report-token-secret";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // crockford-ish, no lookalikes

function randomToken(len) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

export const newJobId = () => `aud_${randomToken(20)}`;
export const newArtifactId = () => `art_${randomToken(20)}`;
export const newReportId = () => `rpt_${randomToken(20)}`;

export function accessTokenFor(jobId) {
  return createHmac("sha256", SECRET).update(`job:${jobId}`).digest("base64url").slice(0, 32);
}

export function verifyAccessToken(jobId, token) {
  if (typeof token !== "string" || !token) return false;
  const expected = Buffer.from(accessTokenFor(jobId));
  const got = Buffer.from(token);
  return got.length === expected.length && timingSafeEqual(expected, got);
}

// Short-lived signed artifact URLs: sig = HMAC(artifactId + expiry).
export function signArtifact(artifactId, ttlSeconds = 900) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", SECRET).update(`art:${artifactId}:${exp}`).digest("base64url").slice(0, 32);
  return { exp, sig };
}

export function verifyArtifactSig(artifactId, exp, sig) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now() / 1000) return false;
  const expected = createHmac("sha256", SECRET).update(`art:${artifactId}:${expNum}`).digest("base64url").slice(0, 32);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
