// POST /api/stripe/webhook — Stripe → us. Verifies the signature against the
// RAW body, is idempotent per Checkout Session id, and on completion runs the
// SAME agent-readiness audit the x402 path uses, stores the report behind the
// deep tier's HMAC bearer-token mechanism, emails the buyer a tokened link, and
// fires the Discord notifier labeled as card revenue.
//
// The audit runs in after() so we return 200 to Stripe immediately (agent
// readiness is fast, but Stripe still wants a prompt ack; retries are safe
// because claimSession() is the idempotency gate).
import { after, NextResponse } from "next/server";
import { stripe, stripeConfigured, HUMAN_REPORT_PRICE_USD } from "../../../../lib/stripe/client.js";
import { claimSession, completePurchase, failPurchase } from "../../../../lib/stripe/store.js";
import { auditAgentReadiness } from "../../../../lib/agent-readiness/analyze.js";
import { websiteIntelligenceSummary } from "../../../../lib/website-intelligence.js";
import { newReportId, accessTokenFor } from "../../../../lib/deep/ids.js";
import { sendReportEmail } from "../../../../lib/email/resend.js";
import { notifyTransaction } from "../../../../notify.js";
import { recordEvent } from "../../../../lib/analytics-store.js";

const NO_STORE = { "Cache-Control": "no-store" };

function siteOrigin() {
  return process.env.PUBLIC_SITE_URL || "https://www.santosautomation.com";
}

async function fulfil({ sessionId, targetUrl, email }) {
  try {
    // Same code path (and same enriched shape) as GET /api/agent-readiness —
    // never a parallel pipeline.
    const result = await auditAgentReadiness(targetUrl, { mode: "quick" });
    const websiteIntelligence = websiteIntelligenceSummary({ agentReadiness: result });
    const report = { website_intelligence_score: websiteIntelligence.score, website_intelligence: websiteIntelligence, ...result };
    const reportId = newReportId();
    await completePurchase(sessionId, reportId, report);

    const token = accessTokenFor(reportId);
    const reportUrl = `${siteOrigin()}/agent-readiness/report/${reportId}?token=${token}`;

    const mail = await sendReportEmail({ to: email, reportUrl, targetUrl });
    if (!mail.ok) console.error("Report email not sent:", mail.reason, "(report is still retrievable at its URL)");

    // Discord: card revenue.
    await notifyTransaction({ url: targetUrl, amount: HUMAN_REPORT_PRICE_USD.toFixed(2), rail: "stripe" });
  } catch (e) {
    console.error("Stripe fulfilment failed:", e.message);
    await failPurchase(sessionId, e.message).catch(() => {});
  }
}

export async function POST(req) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 503, headers: NO_STORE });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text(); // RAW body — required for signature verification
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return NextResponse.json({ error: `Signature verification failed: ${e.message}` }, { status: 400, headers: NO_STORE });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const targetUrl = session.metadata?.target_url;
    const email = session.customer_email || session.customer_details?.email;

    if (targetUrl && email) {
      // Idempotency gate: only the first delivery of this session id enqueues work.
      const isFirst = await claimSession({ sessionId: session.id, targetUrl, email });
      if (isFirst) {
        // Funnel bottom for the card path (fails open, never blocks fulfilment).
        await recordEvent({ event: "payment_completed", props: { rail: "stripe", amount_usd: HUMAN_REPORT_PRICE_USD } });
        after(() => fulfil({ sessionId: session.id, targetUrl, email }));
      }
    } else {
      console.error("checkout.session.completed missing target_url/email:", session.id);
    }
  }

  // Acknowledge everything (including replays and unhandled types) with 200.
  return NextResponse.json({ received: true }, { headers: NO_STORE });
}
