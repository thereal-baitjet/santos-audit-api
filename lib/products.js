// Canonical product catalog — the single source of truth for every public
// Santos product: machine-payable x402 capabilities and human card reports.
//
// Every human-facing and machine-facing surface (homepage, pricing page, docs,
// OpenAPI, MCP, capability manifests, llms.txt, checkout copy, emails, JSON-LD
// offers) must consume or be tested against this module. Prices resolve from
// the same environment variables the production x402 routes and Stripe
// checkout enforce, so a public surface can never drift from what is charged.
// tests/catalog-consistency.test.js guards the agreement.
//
// Display names match the names production already exposes in the capability
// manifest (lib/capabilities.js); do not rename a product here without
// updating every surface in the same change.

import { getAgentReadinessPriceUsdc } from "./agent-readiness/product-pricing.js";

// Resolve an env-overridable USDC price. Falls back to the baked-in default
// when the env var is missing; throws on a malformed override so a bad deploy
// fails loudly instead of advertising a wrong price. The value is returned
// verbatim (validated) so display formatting stays identical everywhere.
function resolveUsdcPrice(env, fallback) {
  const configured = process.env[env]?.trim();
  const price = configured || fallback;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(price) || Number(price) <= 0) {
    throw new Error(`${env} must be a positive USDC amount with at most six decimal places`);
  }
  return price;
}

// Resolve an env-overridable USD dollar price (human card products).
export function resolveUsdPrice(env, fallback) {
  const usd = Number(process.env[env]);
  return Number.isFinite(usd) && usd > 0 ? usd : fallback;
}

// The eleven paid x402 capabilities, in catalog order. `price` is a function
// so tests and server code always read the live environment.
export const API_PRODUCTS = [
  {
    id: "safe-fetch",
    name: "Safe Fetch",
    route: "/v1/fetch",
    method: "GET",
    priceEnv: "SAFE_FETCH_PRICE_USDC",
    defaultPriceUsdc: "0.002",
    billingUnit: "per successful fetch",
    availability: "live",
    summary: "One URL in, raw body out through an SSRF-guarded fetcher — redirects, headers, and timing included.",
  },
  {
    id: "content-extraction",
    name: "Content Extraction",
    route: "/v1/extract",
    method: "POST",
    priceEnv: "EXTRACT_PRICE_USDC",
    defaultPriceUsdc: "0.005",
    billingUnit: "per successful extraction",
    availability: "live",
    summary: "One public page in, clean Markdown out — title, links, and metadata for RAG and research agents.",
  },
  {
    id: "feed-parser",
    name: "Feed Parser",
    route: "/v1/feed",
    method: "GET",
    priceEnv: "FEED_PRICE_USDC",
    defaultPriceUsdc: "0.003",
    billingUnit: "per successful parse",
    availability: "live",
    summary: "Any RSS 2.0, Atom, or JSON Feed URL parsed to normalized JSON with up to 50 items.",
  },
  {
    id: "link-map",
    name: "Link Map",
    route: "/v1/links",
    method: "GET",
    priceEnv: "LINKS_PRICE_USDC",
    defaultPriceUsdc: "0.003",
    billingUnit: "per successful link map",
    availability: "live",
    summary: "One page mapped into a categorized link map — internal/external plus topic tags, up to 200 links.",
  },
  {
    id: "quick-intelligence",
    name: "Quick Intelligence Audit",
    route: "/api/audit",
    method: "GET",
    priceEnv: "QUICK_AUDIT_PRICE_USDC",
    defaultPriceUsdc: "0.015",
    billingUnit: "per successful audit",
    availability: "live",
    summary: "Synchronous fetch-and-parse triage of one public page: scores, evidence, and prioritized fixes in seconds.",
  },
  {
    id: "agent-readiness",
    name: "Agent Readiness Audit",
    route: "/api/agent-readiness",
    method: "GET",
    priceEnv: "AGENT_READINESS_PRICE_USDC",
    defaultPriceUsdc: "0.075",
    billingUnit: "per successful audit",
    availability: "live",
    summary: "Bounded public assessment of agent-facing discovery, APIs, MCP, trust, and machine-commerce pricing.",
  },
  {
    id: "screenshot-pdf",
    name: "Screenshot & PDF Render",
    route: "/v1/screenshot",
    method: "GET",
    priceEnv: "SCREENSHOT_PRICE_USDC",
    defaultPriceUsdc: "0.01",
    billingUnit: "per successful render",
    availability: "live",
    summary: "One public page rendered as PNG, JPEG, or A4 PDF in a real isolated Chromium browser.",
  },
  {
    id: "summarizer",
    name: "Summarizer",
    route: "/v1/summarize",
    method: "POST",
    priceEnv: "SUMMARIZE_PRICE_USDC",
    defaultPriceUsdc: "0.033",
    billingUnit: "per successful summary",
    availability: "live",
    summary: "One public page summarized into structured key facts and entities, with an optional focus.",
  },
  {
    id: "structured-extraction",
    name: "Structured Extraction",
    route: "/v1/extract/structured",
    method: "POST",
    priceEnv: "STRUCTURED_EXTRACT_PRICE_USDC",
    defaultPriceUsdc: "0.08",
    billingUnit: "per successful extraction (validated against the caller's schema)",
    availability: "live",
    summary: "Structured JSON fields extracted from one public page against your own JSON Schema.",
  },
  {
    id: "batch-audit",
    name: "Batch Audit",
    route: "/api/audit/batch",
    method: "POST",
    priceEnv: "BATCH_AUDIT_PRICE_USDC",
    defaultPriceUsdc: "0.50",
    billingUnit: "flat batch — up to 50 URLs",
    availability: "live",
    summary: "Volume triage: up to 50 public URLs audited for one flat payment, per-URL failure isolation.",
  },
  {
    id: "deep-intelligence",
    name: "Deep Intelligence Audit",
    route: "/v1/audits",
    method: "POST",
    priceEnv: "DEEP_AUDIT_PRICE_USDC",
    defaultPriceUsdc: "0.225",
    billingUnit: "per compute reservation",
    availability: "live",
    summary: "Browser-rendered website intelligence: Lighthouse lab metrics, rendered axe-core findings, screenshots, network and console evidence.",
  },
];

// Human card products. Prices match the production Stripe checkout
// configuration (lib/stripe/client.js and lib/monitoring/checkout.js read
// from this catalog). Card fee floors make per-call pricing impossible, so
// human products are value-priced formatted reports, not raw API calls.
export const HUMAN_PRODUCTS = [
  {
    id: "quick-report",
    tier: "quick",
    name: "Quick Report",
    stripeName: "Agent Readiness Report (Quick)",
    priceEnv: "HUMAN_QUICK_PRICE_USD",
    defaultPriceUsd: 9,
    billing: "one-time",
    url: "/agent-readiness/buy",
    summary: "Fetch-based agent readiness report — formatted, emailed, and verifiable. Delivered same day.",
  },
  {
    id: "deep-report",
    tier: "deep",
    name: "Deep Report",
    stripeName: "Website Intelligence Report (Deep, browser-rendered)",
    priceEnv: "HUMAN_DEEP_PRICE_USD",
    defaultPriceUsd: 29,
    billing: "one-time",
    url: "/agent-readiness/buy",
    summary: "Browser-rendered website intelligence report — real-browser evidence, screenshots, formatted, emailed, and verifiable.",
  },
  {
    id: "monitoring",
    tier: "monitoring",
    name: "Monitoring",
    stripeName: "Santos Monitoring — weekly website intelligence",
    priceEnv: "MONITORING_PRICE_USD",
    defaultPriceUsd: 9,
    billing: "monthly",
    url: "/monitoring",
    summary: "Weekly re-audit of any URL, an alert when your score moves 5+ points, and a monthly digest.",
  },
];

// Resolved API products with live prices. Returns plain objects safe to
// serialize into JSON-LD, manifests, and pages.
export function apiProducts() {
  return API_PRODUCTS.map((product) => ({
    ...product,
    priceUsdc:
      product.id === "agent-readiness"
        ? getAgentReadinessPriceUsdc()
        : resolveUsdcPrice(product.priceEnv, product.defaultPriceUsdc),
  }));
}

// Resolved human products with live prices (in whole/fractional USD dollars).
export function humanProducts() {
  return HUMAN_PRODUCTS.map((product) => ({
    ...product,
    priceUsd: resolveUsdPrice(product.priceEnv, product.defaultPriceUsd),
  }));
}

export function humanProduct(idOrTier) {
  const product = HUMAN_PRODUCTS.find((entry) => entry.id === idOrTier || entry.tier === idOrTier);
  return product ? { ...product, priceUsd: resolveUsdPrice(product.priceEnv, product.defaultPriceUsd) } : null;
}

export function apiProduct(idOrRoute) {
  const product = apiProducts().find((entry) => entry.id === idOrRoute || entry.route === idOrRoute);
  return product ?? null;
}

// The public "N paid capabilities" claim — always derived, never hardcoded.
export const PAID_CAPABILITY_COUNT = API_PRODUCTS.length;

// Cheapest paid entry point, for "from $X per call" claims.
export function entryPriceUsdc() {
  return apiProducts().reduce((min, product) => (Number(product.priceUsdc) < Number(min) ? product.priceUsdc : min), apiProducts()[0].priceUsdc);
}

// USDC display helper: "$0.015 USDC".
export function usdcLabel(amount) {
  return `$${amount} USDC`;
}

// USD display helper: "$9" (trims ".00").
export function usdLabel(amount) {
  const rounded = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}
