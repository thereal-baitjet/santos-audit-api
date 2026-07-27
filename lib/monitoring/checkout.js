// Stripe Checkout Session params for a Santos Monitoring subscription. Built
// here (not in the route) so the shape is unit-testable without importing
// next/server — same pattern as checkoutMetadata() in lib/stripe/client.js.

export const MONITORING_PRODUCT_NAME = "Santos Monitoring — weekly website intelligence";

// Dollar price, env-overridable (MONITORING_PRICE_USD=12). Falls back to $9
// when missing or not a positive number. Read at call time so tests can vary
// the environment.
export function monitoringPriceUsd() {
  const usd = Number(process.env.MONITORING_PRICE_USD ?? "9");
  return Number.isFinite(usd) && usd > 0 ? usd : 9;
}

export function monitoringAmountCents() {
  return Math.round(monitoringPriceUsd() * 100);
}

// Full params for stripe().checkout.sessions.create(). Prices are
// server-controlled (inline price_data); the client supplies only url+email.
export function monitoringCheckoutParams({ email, targetUrl, origin }) {
  return {
    mode: "subscription",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: monitoringAmountCents(),
        recurring: { interval: "month" },
        product_data: { name: MONITORING_PRODUCT_NAME },
      },
    }],
    customer_email: email,
    metadata: { product: "monitoring", target_url: targetUrl },
    success_url: `${origin}/monitoring/thanks`,
    cancel_url: `${origin}/monitoring?canceled=1`,
  };
}
