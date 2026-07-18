import { NextResponse } from "next/server";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";
import { capabilityManifest } from "../../lib/capabilities.js";
import { AGENT_READINESS_BILLING_UNIT, getAgentReadinessPriceUsdc } from "../../lib/agent-readiness/product-pricing.js";

export async function GET() {
  const readinessPrice = getAgentReadinessPriceUsdc();
  return NextResponse.json(
    {
      manifest_version: "1",
      name: "Santos Site Audit API",
      version: "2.2.2",
      description:
        "A lightweight machine-payable single-page website audit API. Returns performance signals, SEO signals, basic HTML accessibility signals, security-header checks, 0-100 category scores, and actionable remediation guidance.",
      canonical_url: PUBLIC_API_BASE_URL,
      openapi_url: `${PUBLIC_API_BASE_URL}/openapi.json`,
      llms_url: `${PUBLIC_API_BASE_URL}/llms.txt`,
      mcp_url: `${PUBLIC_API_BASE_URL}/mcp`,
      capability_manifest_url: `${PUBLIC_API_BASE_URL}/capabilities.json`,
      website: "https://www.santosautomation.com",
      pricing: {
        amount: "0.005",
        currency: "USDC",
        atomic_amount: "5000",
        billing_unit: "successful audit",
      },
      payment: {
        protocol: "x402 v2",
        network: "eip155:8453",
        scheme: "exact",
        challenge_header: "PAYMENT-REQUIRED",
        authorization_header: "PAYMENT-SIGNATURE",
        receipt_header: "PAYMENT-RESPONSE",
      },
      capabilities: [
        "performance signals (fetch timing, page weight, script/stylesheet counts)",
        "SEO signals (title, meta description, headings, canonical, OpenGraph)",
        "basic HTML accessibility signals (alt text, lang, viewport)",
        "security-header checks (HTTPS, HSTS, CSP)",
        "structured remediation guidance",
      ],
      limitations: [
        "audits a single page per call (no crawling)",
        "no JavaScript rendering or Core Web Vitals",
        "no full WCAG conformance or vulnerability scanning",
        "public pages only; private/internal addresses rejected",
        "15s timeout, 5 redirects, 5MB response cap, ports 80/443 only",
      ],
      tiers: {
        quick: {
          endpoint: "GET /api/audit?url=",
          price_usdc: "0.005",
          mode: "synchronous",
          engine: "fetch + HTML parsing (no browser)",
        },
        "agent-readiness": {
          capability_id: "agent-readiness.quick",
          endpoint: "GET /api/agent-readiness?url=&depth=quick",
          price_usdc: readinessPrice,
          billing_unit: AGENT_READINESS_BILLING_UNIT,
          mode: "synchronous, bounded passive discovery",
          engine: "fetch + HTML/JSON interface analysis; no authentication to or payment of the audited target; no business tool invocation",
          schema_version: "1.0.0",
          enabled: process.env.AGENT_READINESS_ENABLED !== "false",
        },
        "deep-page": {
          endpoint: "POST /v1/audits",
          price_usdc: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075",
          mode: "asynchronous job (poll status_url)",
          engine: "Chromium/Playwright + Lighthouse + rendered axe-core + network evidence + screenshots + passive security",
          payment_note: "Payment buys one bounded compute reservation; settles when the job is accepted, not on report completion. Use an Idempotency-Key header.",
          enabled: process.env.DEEP_AUDIT_ENABLED === "true",
        },
      },
      endpoints: {
        "GET /api/audit?url=": "$0.005 USDC via x402 v2 — quick audit, synchronous",
        "GET /api/agent-readiness?url=&depth=quick": `$${readinessPrice} USDC via x402 v2 — Agent Readiness audit, synchronous`,
        "POST /v1/audits": `$${process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075"} USDC via x402 v2 — deep page audit job, asynchronous`,
        "GET /api/audit/demo?url=": "free, 1/day per IP, human demo",
        "POST /mcp": "MCP server (Streamable HTTP) — free preview tool audit_website_preview",
      },
      capability_manifest: capabilityManifest(),
      contact: "https://santosautomation.com",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } }
  );
}
