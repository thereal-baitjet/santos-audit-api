// Server-side Stripe config. Prices live ONLY here (or a Stripe-hosted price
// via STRIPE_PRICE_ID) — never trusted from the client.
import Stripe from "stripe";

// Tiered human card reports. Card fee floors (~$0.30 + 2.9%) make per-x402-call
// pricing impossible, so the human products are value-priced bundled reports:
// quick (fetch-based agent readiness, same-day) and deep (browser-rendered
// website intelligence, fulfilled by the audit worker queue).
export const REPORT_TIERS = {
  quick: { amount: 900, name: "Agent Readiness Report (Quick)", env: "HUMAN_QUICK_PRICE_USD" },
  deep: { amount: 2900, name: "Website Intelligence Report (Deep, browser-rendered)", env: "HUMAN_DEEP_PRICE_USD" },
};

// Dollar price for a tier, env-overridable in dollars (e.g. HUMAN_DEEP_PRICE_USD=35).
// Falls back to the baked-in amount when the env var is missing or not a
// positive number. Read at call time so tests can vary the environment.
export function tierPriceUsd(key) {
  const tier = REPORT_TIERS[key];
  if (!tier) return null;
  const usd = Number(process.env[tier.env]);
  return Number.isFinite(usd) && usd > 0 ? usd : tier.amount / 100;
}

export function tierAmountCents(key) {
  const usd = tierPriceUsd(key);
  return usd == null ? null : Math.round(usd * 100);
}

// Checkout Session metadata for a report purchase. Built here (not in the
// route) so the shape is unit-testable without importing next/server.
export function checkoutMetadata({ targetUrl, tier }) {
  return { target_url: targetUrl, product: "agent_readiness_report", tier };
}

// Backward-compat: pre-tier callers/tests treat "the human report" as Quick.
export const HUMAN_REPORT_PRICE_USD = tierPriceUsd("quick");
export const HUMAN_REPORT_AMOUNT_CENTS = HUMAN_REPORT_PRICE_USD * 100;
export const HUMAN_REPORT_NAME = REPORT_TIERS.quick.name;

let client = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
