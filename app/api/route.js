import { NextResponse } from "next/server";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";

export async function GET() {
  return NextResponse.json(
    {
      manifest_version: "1",
      name: "Santos Site Audit API",
      version: "2.0.0",
      description:
        "A lightweight machine-payable single-page website audit API. Returns performance signals, SEO signals, basic HTML accessibility signals, security-header checks, 0-100 category scores, and actionable remediation guidance.",
      canonical_url: PUBLIC_API_BASE_URL,
      openapi_url: `${PUBLIC_API_BASE_URL}/openapi.json`,
      llms_url: `${PUBLIC_API_BASE_URL}/llms.txt`,
      mcp_url: `${PUBLIC_API_BASE_URL}/mcp`,
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
      endpoints: {
        "GET /api/audit?url=": "$0.005 USDC via x402 v2 — unlimited, for agents",
        "GET /api/audit/demo?url=": "free, 1/day per IP, human demo",
        "POST /mcp": "MCP server (Streamable HTTP) — free preview tool audit_website_preview",
      },
      contact: "https://santosautomation.com",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } }
  );
}
