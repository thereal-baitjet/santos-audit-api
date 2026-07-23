// First-party analytics sink. Privacy by design: accepts only a whitelisted
// event name plus scalar props, stores the minimum, and never receives or
// records URLs, report contents, wallet data, or payment signatures (the client
// helper strips those before sending). No cookies, no cross-site anything.
// Events persist to analytics_events (migration 008) via lib/analytics-store.js,
// which FAILS OPEN — when the database is unavailable we keep a console trail.
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { recordEvent } from "../../../lib/analytics-store.js";
import { ipFromRequest } from "../../../lib/demo-limit.js";

const ALLOWED = new Set([
  "homepage_viewed", "free_audit_started", "free_audit_completed", "free_audit_failed",
  "email_verification_requested", "email_verified", "free_audit_locked_out",
  "llms_txt_generated",
  "pricing_viewed", "sample_report_viewed", "paid_agent_flow_viewed",
  "payment_challenge_received", "payment_started", "payment_completed",
  "payment_rejected", "agent_audit_completed", "openapi_downloaded", "contact_clicked",
]);

const HASH_SECRET = process.env.RATE_LIMIT_HASH_SECRET ?? "santos-demo-limit";

// Same HMAC scheme as lib/demo-limit.js: raw IPs never persist.
function ipHash(req) {
  const ip = ipFromRequest(req);
  if (ip === "unknown") return null;
  return createHmac("sha256", HASH_SECRET).update(ip).digest("hex").slice(0, 32);
}

export async function POST(req) {
  try {
    const { e, p, t } = await req.json();
    if (ALLOWED.has(e)) {
      const props = p && typeof p === "object" ? p : {};
      const clientTs = Number.isFinite(t) ? new Date(t).toISOString() : null;
      const persisted = await recordEvent({
        event: e,
        props,
        clientTs,
        ipHash: ipHash(req),
        userAgent: req.headers.get("user-agent"),
      });
      if (!persisted) {
        // Fallback trail when the durable sink is unavailable.
        console.log(JSON.stringify({ analytics: e, at: new Date().toISOString() }));
      }
    }
  } catch { /* ignore malformed beacons */ }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
