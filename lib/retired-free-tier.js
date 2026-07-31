// The free HTTP tier is retired. The routes stay MOUNTED on purpose.
//
// Existing integrations are still calling /api/audit/demo and friends, and
// those callers are the warmest audience this service has: they already know
// what the output is worth. A 402 that names the paid successor — with the
// caller's own target already substituted into the URL — converts them. A 404
// would read as an outage and a 410 would close the door without saying where
// the shop moved.
//
// The body mirrors the MCP payment-handoff shape (payment_required, protocol,
// method, url, price_usdc, network) so a client that already understands one
// surface understands this one.
//
// This is NOT itself an x402 challenge: it does not carry PAYMENT-REQUIRED
// terms, because this route has nothing to settle. It points at the route that
// does, which answers with a real challenge on the first unsigned request.
import { NextResponse } from "next/server";
import { CORS } from "./errors.js";
import { apiProduct } from "./products.js";
import { PUBLIC_API_BASE_URL } from "./base-url.js";

const CARD_URL = "https://www.santosautomation.com/agent-readiness/buy";

// Forward the caller's own query so the successor URL is immediately callable.
// `token` is dropped: the verified-email token flow died with the free tier,
// and echoing a dead credential back at a caller is just confusing.
function successorUrl(req, paidRoute) {
  const params = new URLSearchParams(req?.nextUrl?.searchParams ?? "");
  params.delete("token");
  const query = params.toString();
  return `${PUBLIC_API_BASE_URL}${paidRoute}${query ? `?${query}` : ""}`;
}

/**
 * 402 for a retired free endpoint, pointing at its paid successor.
 * Price and method are derived from lib/products.js — never a literal, so the
 * catalog-consistency test stays the single source of truth.
 */
export function retiredFreeTier(req, paidRoute) {
  const product = apiProduct(paidRoute);
  if (!product) throw new Error(`retiredFreeTier: no catalog product for ${paidRoute}`);
  const url = successorUrl(req, paidRoute);

  return NextResponse.json(
    {
      error: `The free tier has been retired. ${product.name} is paid-only: $${product.priceUsdc} USDC ${product.billingUnit}.`,
      code: "FREE_TIER_RETIRED",
      payment_required: true,
      protocol: "x402-v2",
      method: product.method,
      url,
      price_usdc: product.priceUsdc,
      network: "eip155:8453",
      settles: "only on a successful (2xx) response",
      how: `Request ${url} without a signature to receive PAYMENT-REQUIRED terms, then sign and retry with PAYMENT-SIGNATURE. No account or API key is required.`,
      for_humans: `No USDC wallet? Buy a one-time human report by card ($9 Quick / $29 Deep) at ${CARD_URL} — no account needed.`,
    },
    {
      status: 402,
      headers: {
        ...CORS,
        // No `Link: rel="successor-version"` here: next.config.js sets a global
        // Link header for /:path* that overrides route-level ones, so it would
        // never reach the caller. The body's `url` is the channel that works.
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

/**
 * 410 for a retired free endpoint with NO paid successor — currently only the
 * llms.txt draft generator, which was never sold. Nothing to point a payment
 * at, so this says so plainly rather than inventing a price.
 */
export function retiredWithoutSuccessor(what) {
  return NextResponse.json(
    {
      error: `${what} has been retired.`,
      code: "ENDPOINT_RETIRED",
      for_humans: `The paid capabilities are documented at ${PUBLIC_API_BASE_URL}/docs. Human reports by card: ${CARD_URL}.`,
    },
    { status: 410, headers: { ...CORS, "Cache-Control": "public, max-age=3600" } }
  );
}
