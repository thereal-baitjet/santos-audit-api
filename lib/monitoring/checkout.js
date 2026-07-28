// Stripe Checkout Session params for a Santos Monitoring subscription. Built
// here (not in the route) so the shape is unit-testable without importing
// next/server — same pattern as checkoutMetadata() in lib/stripe/client.js.
import { humanProduct } from "../products.js";

export const MONITORING_PRODUCT_NAME = humanProduct("monitoring").stripeName;

// Dollar price, env-overridable (MONITORING_PRICE_USD=12). Falls back to $9
// when missing or not a positive number. Read at call time so tests can vary
// the environment. Resolved from the canonical catalog (lib/products.js).
export function monitoringPriceUsd() {
  return humanProduct("monitoring").priceUsd;
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
