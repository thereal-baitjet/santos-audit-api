// First-party analytics sink. Privacy by design: accepts only a whitelisted
// event name plus scalar props, stores/logs the minimum, and never receives or
// records URLs, report contents, wallet data, or payment signatures (the client
// helper strips those before sending). No cookies, no cross-site anything.
import { NextResponse } from "next/server";

const ALLOWED = new Set([
  "homepage_viewed", "free_audit_started", "free_audit_completed", "free_audit_failed",
  "pricing_viewed", "sample_report_viewed", "paid_agent_flow_viewed",
  "payment_challenge_received", "payment_started", "payment_completed",
  "payment_rejected", "agent_audit_completed", "openapi_downloaded", "contact_clicked",
]);

export async function POST(req) {
  try {
    const { e } = await req.json();
    if (ALLOWED.has(e)) {
      // Minimal, non-identifying record. Swap console for a durable sink later.
      console.log(JSON.stringify({ analytics: e, at: new Date().toISOString() }));
    }
  } catch { /* ignore malformed beacons */ }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
