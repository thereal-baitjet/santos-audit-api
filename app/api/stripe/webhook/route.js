// POST /api/stripe/webhook — Stripe → us. Verifies the signature against the
// RAW body, is idempotent per Checkout Session id, and on completion fulfils by
// tier from the session metadata:
//   quick — runs the SAME agent-readiness audit the x402 path uses, stores the
//     report behind the deep tier's HMAC bearer-token mechanism, emails the
//     buyer a tokened link, and fires the Discord notifier as card revenue.
//   deep — enqueues a Deep Page Audit job directly via lib/deep/store.js (the
//     same in-process bypass of the x402 HTTP layer the quick path uses), marks
//     the purchase "processing", and lets the cron sweep email on completion.
// Sessions with metadata.product="monitoring" provision a Santos Monitoring
// subscription instead (weekly re-audit, see lib/monitoring/*);
// customer.subscription.deleted and invoice.payment_failed keep its status in
// sync (canceled / past_due).
//
// The audit runs in after() so we return 200 to Stripe immediately (agent
// readiness is fast, but Stripe still wants a prompt ack; retries are safe
// because claimSession() is the idempotency gate).
import { after, NextResponse } from "next/server";
import { requireSecret } from "../../../../lib/required-env.js";
import { createHmac } from "node:crypto";
import { stripe, stripeConfigured, tierPriceUsd, HUMAN_REPORT_PRICE_USD } from "../../../../lib/stripe/client.js";
import { claimSession, completePurchase, failPurchase, markProcessing } from "../../../../lib/stripe/store.js";
import { auditAgentReadiness } from "../../../../lib/agent-readiness/analyze.js";
import { websiteIntelligenceSummary } from "../../../../lib/website-intelligence.js";
import { newJobId, newReportId, accessTokenFor } from "../../../../lib/deep/ids.js";
import { normalizeCreateRequest } from "../../../../lib/deep/schemas.js";
import { getStore } from "../../../../lib/deep/store.js";
import { sendReportEmail, sendMonitoringWelcomeEmail, sendPaymentFailedEmail } from "../../../../lib/email/resend.js";
import { averagePublicScore } from "../../../../lib/public-reports.js";
import { insertSubscription, markCanceled, markPastDue, insertRun, updateScoreAndRun } from "../../../../lib/monitoring/store.js";
import { monitoringTokenFor } from "../../../../lib/monitoring/tokens.js";
import { notifyTransaction } from "../../../../notify.js";
import { recordEvent } from "../../../../lib/analytics-store.js";

const NO_STORE = { "Cache-Control": "no-store" };
const IDEM_SECRET = requireSecret("IDEMPOTENCY_HASH_SECRET", "dev-only-idem-secret");

function siteOrigin() {
  return process.env.PUBLIC_SITE_URL || "https://www.santosautomation.com";
}

// Quick tier: unchanged synchronous path.
async function fulfilQuick({ sessionId, targetUrl, email }) {
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

    // Index average is a nice-to-have stat line in the email; never block
    // fulfilment on the leaderboard read.
    const indexAverage = await averagePublicScore().catch(() => null);
    const mail = await sendReportEmail({ to: email, reportUrl, targetUrl, tier: "quick", score: result.score, indexAverage });
    if (!mail.ok) console.error("Report email not sent:", mail.reason, "(report is still retrievable at its URL)");

    // Discord: card revenue.
    await notifyTransaction({ url: targetUrl, amount: HUMAN_REPORT_PRICE_USD.toFixed(2), rail: "stripe" });
  } catch (e) {
    console.error("Stripe fulfilment failed:", e.message);
    await failPurchase(sessionId, e.message).catch(() => {});
  }
}

// Deep tier: enqueue a worker job; no email here.
async function fulfilDeep({ sessionId, targetUrl, email }) {
  try {
    const request = normalizeCreateRequest({ url: targetUrl });
    // Distinct per purchase so the same URL bought twice makes two jobs.
    const requestHash = createHmac("sha256", IDEM_SECRET).update(JSON.stringify(request)).update(sessionId).digest("hex");
    const job = await getStore().createJob({
      id: newJobId(),
      request,
      requestHash,
      paymentReference: sessionId, // card receipt reference, not a chain tx
    });
    await markProcessing(sessionId, job.id);

    // The cron deep-tier sweep (app/api/cron/daily) polls purchases with
    // status='processing', reads job status via getStore().getJob(job_id), and
    // on completion emails the buyer and calls completePurchase().

    // Discord: card revenue.
    await notifyTransaction({ url: targetUrl, amount: tierPriceUsd("deep").toFixed(2), rail: "stripe" });
  } catch (e) {
    console.error("Stripe deep fulfilment failed:", e.message);
    await failPurchase(sessionId, e.message).catch(() => {});
  }
}

async function fulfil(args) {
  if (args.tier === "deep") return fulfilDeep(args);
  return fulfilQuick(args);
}

// Monitoring subscription (metadata.product="monitoring", mode subscription):
// provision the row idempotently, run the first quick audit immediately, and
// send the welcome email with the signed manage link. If the audit or email
// fails after the row exists, the weekly cron sweep self-heals (last_run_at is
// null, so the subscription is picked up first).
async function startMonitoring({ session, targetUrl, email }) {
  try {
    if (!session.subscription) {
      console.error("Monitoring checkout session has no subscription id:", session.id);
      return;
    }
    const sub = await insertSubscription({
      email,
      targetUrl,
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: session.subscription,
    });
    if (!sub) return; // replay — already provisioned by the first delivery

    const result = await auditAgentReadiness(targetUrl, { mode: "quick" });
    await insertRun({ subscriptionId: sub.id, score: result.score, report: result });
    await updateScoreAndRun({ id: sub.id, score: result.score });

    const manageUrl = `${siteOrigin()}/monitoring/manage?t=${monitoringTokenFor(sub.id)}`;
    const mail = await sendMonitoringWelcomeEmail({ to: email, targetUrl, score: result.score, manageUrl });
    if (!mail.ok) console.error("Monitoring welcome email not sent:", mail.reason);

    await recordEvent({ event: "monitoring_started", props: {} });
  } catch (e) {
    console.error("Monitoring provisioning failed:", e.message);
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

    if (session.metadata?.product === "monitoring") {
      if (targetUrl && email) {
        // insertSubscription() is the idempotency gate (replays skip).
        after(() => startMonitoring({ session, targetUrl, email }));
      } else {
        console.error("Monitoring checkout.session.completed missing target_url/email:", session.id);
      }
    } else {
      // Anything unexpected (old sessions without the key) fulfils as quick.
      const tier = session.metadata?.tier === "deep" ? "deep" : "quick";

      if (targetUrl && email) {
        // Idempotency gate: only the first delivery of this session id enqueues work.
        const isFirst = await claimSession({ sessionId: session.id, targetUrl, email, tier });
        if (isFirst) {
          // Funnel bottom for the card path (fails open, never blocks fulfilment).
          await recordEvent({ event: "payment_completed", props: { rail: "stripe", amount_usd: tierPriceUsd(tier), tier } });
          after(() => fulfil({ sessionId: session.id, targetUrl, email, tier }));
        }
      } else {
        console.error("checkout.session.completed missing target_url/email:", session.id);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    try {
      await markCanceled(subscription.id);
    } catch (e) {
      console.error("Failed to mark monitoring subscription canceled:", e.message);
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const stripeSubscriptionId = invoice.subscription;
    if (stripeSubscriptionId) {
      try {
        const sub = await markPastDue(stripeSubscriptionId);
        if (sub) {
          const manageUrl = `${siteOrigin()}/monitoring/manage?t=${monitoringTokenFor(sub.id)}`;
          const mail = await sendPaymentFailedEmail({ to: sub.email, manageUrl });
          if (!mail.ok) console.error("Payment-failed email not sent:", mail.reason);
        }
      } catch (e) {
        console.error("Failed to handle invoice.payment_failed:", e.message);
      }
    }
  }

  // Acknowledge everything (including replays and unhandled types) with 200.
  return NextResponse.json({ received: true }, { headers: NO_STORE });
}
