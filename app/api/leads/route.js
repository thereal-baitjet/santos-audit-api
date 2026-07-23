// POST /api/leads — capture an email (+ attempted URL) from a human who hit
// the shared free-demo quota, so tomorrow's free audit can be sent to them.
// Capture only: no email is sent from this route.
import { NextResponse } from "next/server";
import { validateTarget, AuditError } from "../../../lib/safe-fetch.js";
import { saveLead } from "../../../lib/leads/store.js";

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

  // Same SSRF rules as checkout: never store a target we could not audit.
  let target;
  try {
    target = validateTarget(String(body.url ?? "")).href;
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "INVALID_URL";
    return NextResponse.json({ error: e.message, code }, { status: 400, headers: NO_STORE });
  }

  const source = String(body.source ?? "audit-widget").slice(0, 100) || "audit-widget";

  try {
    await saveLead({ email, targetUrl: target, source });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    // DB configured but unreachable/migrated-out: honest error beats a silent drop.
    console.error("Lead capture failed:", e.message);
    return NextResponse.json({ error: "Could not save that right now. Please try again tomorrow.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }
}
