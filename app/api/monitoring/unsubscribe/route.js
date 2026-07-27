// POST /api/monitoring/unsubscribe — self-serve cancellation from the signed
// manage link. Verifies the HMAC token again server-side, cancels the Stripe
// subscription (tolerating an already-canceled one), and marks the local row
// canceled. Fails soft: a Stripe hiccup after the row is canceled is logged,
// not surfaced as a 5xx, because the user's state is already correct.
import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "../../../../lib/stripe/client.js";
import { verifyMonitoringToken } from "../../../../lib/monitoring/tokens.js";
import { getSubscriptionById, cancelById } from "../../../../lib/monitoring/store.js";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON.", code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  const subscriptionId = verifyMonitoringToken(body.token);
  if (!subscriptionId) {
    return NextResponse.json({ error: "This manage link isn't valid.", code: "INVALID_TOKEN" }, { status: 400, headers: NO_STORE });
  }

  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) {
    return NextResponse.json({ error: "Subscription not found.", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }

  if (sub.status !== "canceled" && sub.stripe_subscription_id && stripeConfigured()) {
    try {
      await stripe().subscriptions.cancel(sub.stripe_subscription_id);
    } catch (e) {
      // Already canceled on Stripe's side is fine; anything else is logged and
      // we still cancel locally so the user isn't charged-alerted again.
      console.error("Stripe subscription cancel failed (canceling locally anyway):", e.message);
    }
  }

  await cancelById(subscriptionId);
  return NextResponse.json({ ok: true, status: "canceled" }, { headers: NO_STORE });
}
