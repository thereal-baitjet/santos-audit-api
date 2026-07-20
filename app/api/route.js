import { NextResponse } from "next/server";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";
import { capabilityManifest } from "../../lib/capabilities.js";
import { AGENT_READINESS_BILLING_UNIT, getAgentReadinessPriceUsdc } from "../../lib/agent-readiness/product-pricing.js";

export async function GET() {
  const readinessPrice = getAgentReadinessPriceUsdc();
  return NextResponse.json(
    {
      manifest_version: "1",
      name: "Santos Website Intelligence API",
      alternate_name: "Santos Agent Readiness API",
      version: "2.3.1",
      description:
        "AI Website Intelligence for measuring whether public websites can be discovered, understood, trusted, and used by AI agents. Returns structured evidence, applicability, coverage, scores, and prioritized remediation.",
      canonical_url: PUBLIC_API_BASE_URL,
      openapi_url: `${PUBLIC_API_BASE_URL}/openapi.json`,
      llms_url: `${PUBLIC_API_BASE_URL}/llms.txt`,
      mcp_url: `${PUBLIC_API_BASE_URL}/mcp`,
      capability_manifest_url: `${PUBLIC_API_BASE_URL}/capabilities.json`,
      website: "https://www.santosautomation.com",
      pricing: {
        amount: "0.015",
        currency: "USDC",
        atomic_amount: "15000",
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
        "AI Website Intelligence dimensions (Discoverable, Understandable, Callable, Trustworthy)",
        "applicability-aware Agent Readiness with evidence coverage and confidence",
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
          title: "Quick Intelligence Audit",
          endpoint: "GET /api/audit?url=",
          price_usdc: "0.015",
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
        "safe-fetch": {
          capability_id: "web.safe-fetch",
          title: "Safe Fetch",
          endpoint: "GET /v1/fetch?url=",
          price_usdc: process.env.SAFE_FETCH_PRICE_USDC ?? "0.002",
          mode: "synchronous",
          engine: "SSRF-guarded raw fetch (GET ?url= or POST {url})",
        },
        "content-extraction": {
          capability_id: "content.extract-markdown",
          title: "Page-to-Markdown Extraction",
          endpoint: "POST /v1/extract",
          price_usdc: process.env.EXTRACT_PRICE_USDC ?? "0.005",
          mode: "synchronous",
          engine: "safe-fetch + Readability + Markdown",
        },
        "structured-extraction": {
          capability_id: "content.extract-structured",
          title: "Structured Extraction",
          endpoint: "POST /v1/extract/structured",
          price_usdc: process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08",
          billing_unit: "successful extraction (output validated against caller schema)",
          mode: "synchronous",
          engine: "safe-fetch + Readability + Claude Sonnet 5 forced tool-use, validated against the caller's JSON Schema",
        },
        screenshot: {
          capability_id: "render.screenshot",
          title: "Screenshot & PDF Render",
          endpoint: "GET /v1/screenshot?url=",
          price_usdc: process.env.SCREENSHOT_PRICE_USDC ?? "0.01",
          billing_unit: "successful render",
          mode: "synchronous",
          engine: "real Chromium render (SSRF-guarded)",
        },
        "deep-page": {
          title: "Deep Website Intelligence Audit",
          endpoint: "POST /v1/audits",
          price_usdc: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225",
          mode: "asynchronous job (poll status_url)",
          engine: "Chromium/Playwright + Lighthouse + rendered axe-core + network evidence + screenshots + passive security",
          payment_note: "Payment buys one bounded compute reservation; settles when the job is accepted, not on report completion. Use an Idempotency-Key header.",
          enabled: process.env.DEEP_AUDIT_ENABLED === "true",
        },
      },
      endpoints: {
        "GET /api/audit?url=": "$0.015 USDC via x402 v2 — quick audit, synchronous",
        "GET /api/agent-readiness?url=&depth=quick": `$${readinessPrice} USDC via x402 v2 — Agent Readiness audit, synchronous`,
        "GET /v1/fetch?url=": `$${process.env.SAFE_FETCH_PRICE_USDC ?? "0.002"} USDC via x402 v2 — SSRF-guarded raw fetch, synchronous`,
        "POST /v1/extract": `$${process.env.EXTRACT_PRICE_USDC ?? "0.005"} USDC via x402 v2 — page-to-Markdown extraction, synchronous`,
        "POST /v1/extract/structured": `$${process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08"} USDC via x402 v2 — structured JSON extraction against your schema, synchronous`,
        "GET /v1/screenshot?url=": `$${process.env.SCREENSHOT_PRICE_USDC ?? "0.01"} USDC via x402 v2 — screenshot/PDF render, synchronous`,
        "POST /v1/audits": `$${process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225"} USDC via x402 v2 — deep page audit job, asynchronous`,
        "GET /api/audit/demo?url=": "free, 1/day per IP, human demo",
        "POST /mcp": "MCP server (Streamable HTTP) — free preview tool audit_website_preview",
      },
      capability_manifest: capabilityManifest(),
      contact: "https://www.santosautomation.com",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } }
  );
}
