# Santos Site Audit API

**$0.005 x402 website audit API for AI agents** — performance, SEO, accessibility, and
security, with no account and no API key. Payment happens inside the HTTP request via
the [x402 protocol](https://x402.org): USDC on Base mainnet, settled per-call.

Live: API at **https://api.santosautomation.com** · landing page at
**https://www.santosautomation.com** (same app, two hostnames)

| Surface | URL |
|---|---|
| Quick Audit ($0.005 USDC, synchronous) | `GET /api/audit?url=https://example.com` |
| **Deep Page Audit** ($0.075 USDC, async job) | `POST /v1/audits` `{"url": "https://example.com"}` |
| Free demo (1/day per IP) | `GET /api/audit/demo?url=https://example.com` |
| OpenAPI 3.1 | [`/openapi.json`](https://api.santosautomation.com/openapi.json) |
| llms.txt | [`/llms.txt`](https://api.santosautomation.com/llms.txt) |
| MCP server (tool: `audit_website`) | `POST /mcp` |
| Service manifest | [`/api`](https://api.santosautomation.com/api) |

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

## Deep Page Audit (browser-rendered tier)

Real Chromium via Playwright in an isolated Fly.io worker: Lighthouse lab
metrics, rendered axe-core accessibility findings (with selectors), browser
network/console evidence, screenshots, and passive security checks. Async:
the $0.075 payment buys a **bounded compute reservation** (settles on job
accept, not report completion). `POST /v1/audits` with an `Idempotency-Key`
header → poll `status_url` with the returned one-time `access_token` → fetch
`report_url` (versioned `schema_version: 3.0.0` JSON + signed artifact URLs).
Working buyer example: [`buy-deep.js`](buy-deep.js). Architecture + go-live
runbook: [`docs/deep-audit.md`](docs/deep-audit.md).

## Response shape (Quick Audit)

```json
{
  "tier": "paid",
  "url": "https://example.com/",
  "http_status": 200,
  "timing_ms": { "ttfb": 166, "total": 168 },
  "overall_score": 68,
  "scores": { "performance": 100, "seo": 40, "accessibility": 100, "security": 33 },
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

### Environment variables

See [`.env.example`](.env.example). Required in production: `CDP_API_KEY_ID`,
`CDP_API_KEY_SECRET` (facilitator auth). Optional: `DISCORD_WEBHOOK_URL`
(payment notifications), `PUBLIC_API_BASE_URL` (canonical hostname in docs
output), audit tuning knobs.

### Deploy

`vercel --prod` from a linked checkout. The receiving wallet and network are
hard-coded in `app/api/audit/route.js` on purpose — stale env vars must not
silently flip the API back to testnet.

## Registry listings

Copy-ready submission text for x402 catalogs and the MCP registry:
[`docs/registry-submissions.md`](docs/registry-submissions.md).

## Operator

Santos Automation (Juan Santos) — custom x402 APIs, web apps, e-commerce, and
automation systems. baitjet@gmail.com · https://santosautomation.com
