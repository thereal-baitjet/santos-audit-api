// POST /api/checkout — create a Stripe Checkout Session: a tiered human
// report ($9 Quick / $29 Deep one-time by card) or a Santos Monitoring
// subscription ($9/mo, product="monitoring"). Prices are server-side only; the
// client supplies just the target URL, email, and tier, all validated here.
import { NextResponse } from "next/server";
import { stripe, stripeConfigured, REPORT_TIERS, tierAmountCents, checkoutMetadata } from "../../../lib/stripe/client.js";
import { monitoringCheckoutParams } from "../../../lib/monitoring/checkout.js";
import { validateTarget, AuditError } from "../../../lib/safe-fetch.js";

const NO_STORE = { "Cache-Control": "no-store" };
// Deliberately conservative: enough to catch typos, not a deliverability check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteOrigin(req) {
  return process.env.PUBLIC_SITE_URL || req.nextUrl.origin;
}

export async function POST(req) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Card checkout is not configured on this deployment.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON.", code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  // Products: "report" (one-time tiered report, default) and "monitoring"
  // (monthly subscription). Anything else is an unknown product.
  const product = String(body.product ?? "report").trim() || "report";
  if (product !== "report" && product !== "monitoring") {
    return NextResponse.json({ error: `Unknown product: ${product}.`, code: "INVALID_PRODUCT" }, { status: 400, headers: NO_STORE });
  }

  const tierKey = String(body.tier ?? "quick").trim() || "quick";
  const tier = REPORT_TIERS[tierKey];
  if (product === "report" && !tier) {
    return NextResponse.json({ error: `Unknown report tier: ${tierKey}.`, code: "INVALID_TIER" }, { status: 400, headers: NO_STORE });
  }

  const email = String(body.email ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "A valid email address is required.", code: "INVALID_EMAIL" }, { status: 400, headers: NO_STORE });
  }

  // Reject non-public / invalid / private targets up front (same SSRF rules the
  // x402 and demo paths use), so we never charge for an unauditable URL.
  let target;
  try {
    target = validateTarget(String(body.url ?? "")).href;
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "INVALID_URL";
    return NextResponse.json({ error: e.message, code }, { status: 400, headers: NO_STORE });
  }

  const origin = siteOrigin(req);

  // Monitoring is a subscription Checkout Session; the tier machinery below is
  // for one-time reports only.
  if (product === "monitoring") {
    try {
      const session = await stripe().checkout.sessions.create(
        monitoringCheckoutParams({ email, targetUrl: target, origin })
      );
      return NextResponse.json({ url: session.url }, { headers: NO_STORE });
    } catch (e) {
      console.error("Stripe monitoring checkout create failed:", e.message);
      return NextResponse.json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_FAILED" }, { status: 502, headers: NO_STORE });
    }
  }

  const lineItems = process.env.STRIPE_PRICE_ID
    ? [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: tierAmountCents(tierKey), // server-controlled price
          product_data: {
            name: tier.name,
            description: "One-time audit of one public page, emailed to you.",
          },
        },
      }];

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      metadata: checkoutMetadata({ targetUrl: target, tier: tierKey }),
      success_url: `${origin}/agent-readiness/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/agent-readiness/buy?canceled=1`,
    });
    return NextResponse.json({ url: session.url }, { headers: NO_STORE });
  } catch (e) {
    console.error("Stripe checkout create failed:", e.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_FAILED" }, { status: 502, headers: NO_STORE });
  }
}
