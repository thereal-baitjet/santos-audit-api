// Server-side Stripe config. The price lives ONLY here (or a Stripe-hosted
// price via STRIPE_PRICE_ID) — never trusted from the client.
import Stripe from "stripe";

// $5.00 one-time. Card fee floors (~$0.30 + 2.9%) make per-x402-call pricing
// impossible, so the human product is a value-priced bundled report.
export const HUMAN_REPORT_PRICE_USD = 5;
export const HUMAN_REPORT_AMOUNT_CENTS = HUMAN_REPORT_PRICE_USD * 100;
export const HUMAN_REPORT_NAME = "Agent Readiness Report";

let client = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
