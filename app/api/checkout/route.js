// POST /api/checkout — create a Stripe Checkout Session for the $5 human
// Agent Readiness Report. The price is server-side only; the client supplies
// just the target URL and email, both validated here.
import { NextResponse } from "next/server";
import { stripe, stripeConfigured, HUMAN_REPORT_AMOUNT_CENTS, HUMAN_REPORT_NAME } from "../../../lib/stripe/client.js";
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
  const lineItems = process.env.STRIPE_PRICE_ID
    ? [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]
    : [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: HUMAN_REPORT_AMOUNT_CENTS, // server-controlled price
          product_data: {
            name: HUMAN_REPORT_NAME,
            description: "One-time AI Agent Readiness audit of one public page, emailed to you.",
          },
        },
      }];

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: email,
      metadata: { target_url: target, product: "agent_readiness_report" },
      success_url: `${origin}/agent-readiness/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/agent-readiness/buy?canceled=1`,
    });
    return NextResponse.json({ url: session.url }, { headers: NO_STORE });
  } catch (e) {
    console.error("Stripe checkout create failed:", e.message);
    return NextResponse.json({ error: "Could not start checkout. Please try again.", code: "CHECKOUT_FAILED" }, { status: 502, headers: NO_STORE });
  }
}
