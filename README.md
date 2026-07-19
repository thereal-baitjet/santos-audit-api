# Santos Website Intelligence API

<p align="center">
  <img src="https://img.shields.io/badge/AI-Website%20Intelligence-7c3aed?style=for-the-badge&logo=robot" alt="AI Website Intelligence" />
  <img src="https://img.shields.io/badge/Agent-Readiness-2563eb?style=for-the-badge&logo=lightning" alt="Agent Readiness" />
  <img src="https://img.shields.io/badge/x402-USDC%20on%20Base-0ea5e9?style=for-the-badge&logo=bitcoin" alt="x402 on Base" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs" alt="Next.js" />
</p>

<p align="center">
  <strong>Measure whether a public website is discoverable, understandable, callable, and trustworthy for agents.</strong>
</p>

```text
┌──────────────────────────────────────────────────────────────┐
│   SANTOS WEBSITE INTELLIGENCE • AI-READY WEB EVALUATION   │
│   Discover • Understand • Call • Trust                    │
└──────────────────────────────────────────────────────────────┘
```

**AI Website Intelligence and Agent Readiness for the agentic web** — Quick,
Agent Readiness, and browser-rendered Deep audits return structured evidence and
prioritized fixes. No account or traditional API key; paid resources use the
[x402 protocol](https://x402.org) with USDC on Base.

### Highlights

- 🔍 Quick audits for website intelligence and agent-readiness signals
- 🧠 Browser-rendered Deep audits with Chromium, Lighthouse, and axe-core
- 💳 x402-based payments with USDC on Base
- 📡 OpenAPI, MCP, llms.txt, and capability manifest support

[![Live site](https://img.shields.io/website?url=https%3A%2F%2Fwww.santosautomation.com&label=live%20site)](https://www.santosautomation.com/)
[![Vercel production](https://img.shields.io/badge/production-Vercel-black?logo=vercel)](https://vercel.com/thereal-baitjets-projects/santos-api)
[![API version](https://img.shields.io/badge/API-v2.3.0-d4a24e)](https://api.santosautomation.com/openapi.json)
[![x402](https://img.shields.io/badge/payments-x402%20v2%20%7C%20USDC%20on%20Base-2775ca)](https://x402.org/)
[![OpenAPI](https://img.shields.io/badge/spec-OpenAPI%203.1-6ba539)](https://api.santosautomation.com/openapi.json)
[![License](https://img.shields.io/badge/license-ISC-blue)](package.json)

Live: API at **https://api.santosautomation.com** · landing page at
**https://www.santosautomation.com** (same app, two hostnames)

The public site is positioned as Santos Website Intelligence. Its responsive
navigation uses the gold Santos eagle SVG emblem from `public/assets`.

| Surface | URL |
|---|---|
| Quick Intelligence Audit ($0.005 USDC, synchronous) | `GET /api/audit?url=https://example.com` |
| **Agent Readiness** ($0.025 USDC, bounded passive assessment) | `GET /api/agent-readiness?url=https://example.com&depth=quick` |
| **Deep Website Intelligence Audit** ($0.075 USDC, async job) | `POST /v1/audits` `{"url": "https://example.com"}` |
| Free demo (1/day per IP) | `GET /api/audit/demo?url=https://example.com` |
| OpenAPI 3.1 | [`/openapi.json`](https://api.santosautomation.com/openapi.json) |
| llms.txt | [`/llms.txt`](https://api.santosautomation.com/llms.txt) |
| MCP server (tools: `audit_website_preview`, `audit_agent_readiness`) | `POST /mcp` |
| Service manifest | [`/api`](https://api.santosautomation.com/api) |
| Capability manifest | [`/capabilities.json`](https://api.santosautomation.com/capabilities.json) |
| Well-known capability manifest | [`/.well-known/agent-capabilities.json`](https://www.santosautomation.com/.well-known/agent-capabilities.json) |
| Sitemap / crawler rules | [`/sitemap.xml`](https://www.santosautomation.com/sitemap.xml) · [`/robots.txt`](https://www.santosautomation.com/robots.txt) |

## Website Intelligence model

Santos measures four dimensions across completed, applicable checks:

- **Discoverable** — crawler access, canonical URLs, sitemaps, `llms.txt`, documentation, and interface links.
- **Understandable** — structured identity, JSON-LD, semantic HTML, metadata, pricing, and business context.
- **Callable** — OpenAPI, MCP, capability manifests, typed schemas, stable errors, job endpoints, and x402 where applicable.
- **Trustworthy** — HTTPS, security headers, accessibility, performance, browser behavior, support, and evidence quality.

The additive `website_intelligence_score` and `website_intelligence` fields appear
alongside historical Quick Audit fields. Existing `overall_score`, category
scores, endpoint paths, capability ids, and payment behavior remain compatible.

## Public product pages

- [AI Website Intelligence](https://www.santosautomation.com/ai-website-intelligence)
- [Agent Readiness Audit](https://www.santosautomation.com/agent-readiness-audit)
- [Website Intelligence API](https://www.santosautomation.com/website-intelligence-api)
- [MCP Readiness Checker](https://www.santosautomation.com/mcp-readiness-checker)
- [llms.txt Checker](https://www.santosautomation.com/llms-txt-checker)
- [OpenAPI Readiness Checker](https://www.santosautomation.com/openapi-readiness-checker)
- [Agent Readiness Methodology](https://www.santosautomation.com/methodology/agent-readiness)
- [Sample Agent Readiness Report](https://www.santosautomation.com/reports/sample-agent-readiness)
- [Learning guides](https://www.santosautomation.com/learn/what-is-ai-website-intelligence)

## How agents pay (x402)

```
GET /api/audit?url=example.com
← 402 · PAYMENT-REQUIRED: <base64 terms: $0.005 USDC · eip155:8453 · payTo · asset>
→ retry with PAYMENT-SIGNATURE: <base64 signed EIP-3009 authorization>
← 200 OK · audit JSON · PAYMENT-RESPONSE: <base64 on-chain receipt>
```

Protocol: **x402 v2** (migrated 2026-07-17; legacy v1 `X-PAYMENT` clients are no
longer accepted).

Payment settles **only after a successful response** — a bad URL or unreachable
target costs the agent nothing.

### JavaScript / TypeScript

```js
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay(
  "https://api.santosautomation.com/api/audit?url=example.com"
);
const report = await res.json(); // { overall_score, scores, checks, issues, ... }
```

Working scripts: [`buy-audit.js`](buy-audit.js) (local dev) and
[`buy-live.js`](buy-live.js) (production). Python example:
[`examples/audit_client.py`](examples/audit_client.py).

### Free demo first

Same report shape, no payment, 1/day per IP:

```
curl "https://api.santosautomation.com/api/audit/demo?url=example.com"
```

## Deep Website Intelligence (browser-rendered tier)

Real Chromium via Playwright in an isolated Fly.io worker: Lighthouse lab
metrics, rendered axe-core accessibility findings (with selectors), browser
network/console evidence, screenshots, and passive security checks. Async:
the $0.075 payment buys a **bounded compute reservation** (settles on job
accept, not report completion). `POST /v1/audits` with an `Idempotency-Key`
header → poll `status_url` with the returned one-time `access_token` → fetch
`report_url` (versioned `schema_version: 3.0.0` JSON + signed artifact URLs).
Working buyer example: [`buy-deep.js`](buy-deep.js). Architecture + go-live
runbook: [`docs/deep-audit.md`](docs/deep-audit.md).

## Agent Readiness

The versioned `AgentReadinessResult` assesses public agent-facing discovery,
structured identity, OpenAPI, MCP, operational trust, and x402/machine-commerce
signals. It first classifies applicability, so a normal website is not penalized
for lacking an API, MCP server, or payment interface. The standalone quick pass
uses at most eight bounded requests and never authenticates to or pays the audited
target, submits forms, creates target accounts, invokes target tools, or executes code.

Agent Readiness is also available as the opt-in `agent-readiness` module for
`POST /v1/audits`, through the MCP `audit_agent_readiness` paid-HTTP handoff, and
additively as a lower-coverage embedded preview inside the Quick Audit response.
The standalone result costs **$0.025 USDC per successful response** through x402 v2;
failed audits do not settle. The existing Quick Audit `overall_score` is unchanged.
The standalone response also includes the additive Website Intelligence score and
four-dimensional presentation, with `callable` marked not applicable when the
target does not advertise callable services.
Scoring and standards baselines are documented in
[`docs/agent-readiness-scoring.md`](docs/agent-readiness-scoring.md) and
[`docs/agent-readiness-spec-baseline.md`](docs/agent-readiness-spec-baseline.md).

## Response shape (Quick Intelligence Audit)

```json
{
  "tier": "paid",
  "url": "https://example.com/",
  "http_status": 200,
  "timing_ms": { "ttfb": 166, "total": 168 },
  "overall_score": 68,
  "scores": { "performance": 100, "seo": 40, "accessibility": 100, "security": 33 },
  "website_intelligence_score": 74,
  "website_intelligence": {
    "dimensions": {
      "discoverable": 81,
      "understandable": 68,
      "callable": null,
      "trustworthy": 73
    },
    "applicability": { "callable": "not_applicable" },
    "coverage": { "tests_executed": 28, "tested_percent": 88 },
    "confidence": 0.86,
    "priority_fixes": []
  },
  "checks": { "performance": [ { "pass": true, "detail": "TTFB 166ms" } ] },
  "issues": ["Missing canonical link", "Missing Content-Security-Policy header"]
}
```

Errors are `{ "error": "<human message>", "code": "<STABLE_CODE>" }` with codes
`INVALID_URL`, `UNSUPPORTED_SCHEME`, `PRIVATE_ADDRESS_BLOCKED`, `RATE_LIMITED`,
`AUDIT_TIMEOUT`, `TARGET_UNREACHABLE`, `AUDIT_FAILED`.

## Stack

Next.js App Router on Vercel. Payments: `@x402/next` v2 (`withX402` wrapper) +
`@x402/core`/`@x402/evm` with `@coinbase/x402` (Coinbase CDP facilitator — the
piece that actually settles USDC on Base mainnet) and the `@x402/extensions`
Bazaar discovery extension. Audit engine: `fetch` + `cheerio`, no headless browser.
SSRF-guarded: private/reserved/metadata IPs blocked with per-redirect-hop
revalidation, 15s timeout, 5 redirects, 5 MB cap (`lib/safe-fetch.js`).

## Development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
npm test                     # e2e checks against BASE (default localhost:3000)
BASE=https://api.santosautomation.com EXPECT_NETWORK=base npm test
```

Focused checks for the Website Intelligence layer:

```bash
npm run test:agent-readiness
npm run test:website-intelligence
npm run build
```

### Environment variables

See [`.env.example`](.env.example). Required in production: `CDP_API_KEY_ID`,
`CDP_API_KEY_SECRET` (facilitator auth). Optional: `DISCORD_WEBHOOK_URL`
(payment notifications), `PUBLIC_API_BASE_URL` (canonical hostname in docs
output), audit tuning knobs.

### Deploy

`vercel --prod` from a linked checkout. Vercel deploys the website and API control
plane; the browser-rendered worker is a separate Fly.io deployment and must be
released independently when worker code changes. The receiving wallet and network are
hard-coded in `app/api/audit/route.js` on purpose — stale env vars must not
silently flip the API back to testnet.

## Registry listings

Copy-ready submission text for x402 catalogs and the MCP registry:
[`docs/registry-submissions.md`](docs/registry-submissions.md).

## Operator

Santos Automation (Juan Santos) — custom x402 APIs, web apps, e-commerce, and
automation systems. info@santosautomation.com · https://santosautomation.com
