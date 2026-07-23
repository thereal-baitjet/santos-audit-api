// POST /api/leads/verify/request — email a 6-digit verification code for the
// verified-email free tier. Answers { ok:true } on success (never reveals
// whether an address exists or a rate limit was hit), 503
// EMAIL_DELIVERY_FAILED (+ a Discord ops alert) when the email genuinely
// could not be sent; in non-production without a Resend key it also returns
// dev_code for local testing.
import { NextResponse, after } from "next/server";
import { validateTarget, AuditError } from "../../../../../lib/safe-fetch.js";
import { requestCode } from "../../../../../lib/leads/verify.js";
import { ipFromRequest } from "../../../../../lib/demo-limit.js";
import { notifyOpsAlert } from "../../../../../notify.js";

const NO_STORE = { "Cache-Control": "no-store" };
// Deliberately conservative: enough to catch typos, not a deliverability check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON.", code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "A valid email address is required.", code: "INVALID_EMAIL" }, { status: 400, headers: NO_STORE });
  }

  // Optional target: when present it must pass the same SSRF rules as any
  // audited URL; the widget always sends the URL being audited.
  let targetUrl = "unspecified";
  if (body.url) {
    try {
      targetUrl = validateTarget(String(body.url)).href;
    } catch (e) {
      const code = e instanceof AuditError ? e.code : "INVALID_URL";
      return NextResponse.json({ error: e.message, code }, { status: 400, headers: NO_STORE });
    }
  }

  const source = String(body.source ?? "audit-widget").slice(0, 100) || "audit-widget";

  try {
    const result = await requestCode({ email, targetUrl, source, ip: ipFromRequest(req) });
    if (!result.ok) {
      // Delivery is genuinely broken (missing key, Resend error): tell the
      // user honestly and page ops — a silent ok here costs a funnel user.
      after(() => notifyOpsAlert({ title: "Verification email delivery failed", detail: `${result.code}: ${result.reason ?? "unknown"}` }));
      return NextResponse.json({ error: "We could not send the verification email right now. Please try again later.", code: "EMAIL_DELIVERY_FAILED" }, { status: 503, headers: NO_STORE });
    }
    const payload = { ok: true };
    if (result.dev_code) payload.dev_code = result.dev_code;
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (e) {
    console.error("Verification code request failed:", e.message);
    return NextResponse.json({ error: "Could not send a code right now. Please try again later.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }
}
