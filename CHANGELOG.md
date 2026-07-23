# Changelog

## 2.8.1 — 2026-07-23 — Batch goes flat: 50 URLs for $0.50

### Changed
- **POST /api/audit/batch** is now a flat **$0.50 USDC for up to 50 URLs**
  (was $0.10 for up to 10) — $0.01/URL at full capacity, ~33% under per-call.
  Concurrency raised to 8 and the route budget to 300s to keep worst-case
  batches inside the limit. Discovery surfaces updated to match.

## 2.8.0 — 2026-07-23 — Batch Quick Intelligence Audit (the volume rail)

### Added
- **POST /api/audit/batch** ($0.10 USDC via x402 v2): up to 10 public URLs
  audited in one payment (~33% under 10 × $0.015 per-call). Duplicates removed,
  4-way bounded concurrency, per-URL failure isolation (one bad target returns
  an error entry, not a failed batch). Settlement follows the suite rule
  adapted to batches: payment settles only when at least one audit succeeds —
  an all-failure batch returns 502 and is never charged. Synchronous, 60s cap.
  Discovery surfaces updated per the suite template: OpenAPI, llms.txt,
  capabilities manifest (`site-audit.quick-batch`), /api service manifest,
  Bazaar discovery extension.

## 2.7.1 — 2026-07-22 — Conversion funnel + trust surfaces

### Added
- **GET /api/agent-readiness/demo** — free 1/day/IP demo of the flagship Agent
  Readiness audit (shared quota with all demos), same quick-pass result shape
  as the paid endpoint. Documented in OpenAPI, llms.txt, the /api service
  manifest, and the MCP `audit_agent_readiness` handoff.
- **POST /api/leads** — email capture for humans who exhaust the free demo
  quota (`demo_leads` table, migration 008_demo_leads). Capture only; nothing
  is emailed yet.
- **Trust surfaces:** `/status` (components + operational expectations, not a
  live SLA monitor), `/changelog` (public product history), `/version`
  (machine-readable JSON: API version, schema versions, contract URLs).
  Linked from the site footer and sitemap.
- First-party analytics now persist to Postgres (`analytics_events`, migration
  008_analytics_events) via lib/analytics-store.js; `payment_completed` is
  recorded for both Stripe card purchases and settled x402 payments.

### Changed
- All demo 429 responses now include `for_humans` (card checkout pointer) and
  `retry_after`. The browser widget renders an inline email-capture form on
  429 instead of a dead-end error.
- Demo widget embedded on all six marketing pages (was one).
- robots.txt simplified to open-by-default (`Allow: /`, disallowing only
  `/_next/` and `/admin/`) for clean agent discovery.

### Fixed
- Human card checkout now charges the advertised $5 (the Stripe constant was
  $19 while all copy said $5).
- Widget analytics events renamed to the whitelist (`free_audit_*`) and now
  reach the beacon; removed a duplicate click binding that double-counted
  CTA clicks.

## 2.7.0 — 2026-07-20 — Structured Extraction (the suite's first metered-LLM-cost product)

### Added
- **POST /v1/extract/structured** ($0.08 USDC via x402 v2, no GET variant): pass
  a public page URL plus your own JSON Schema, get back JSON extracted by Claude
  Sonnet 5 with forced tool-use and validated against your schema before it's
  returned. Built on lib/extract.js (safe-fetch + Readability + Markdown) —
  content truncated to 8000 characters and model output capped at 1024 tokens
  before any Claude call, the primary defense against runaway upstream cost.
  Caller schema must be self-contained (type: object, no $ref, under 4000
  characters) or the request 400s before any fetch or model call. Settles only
  when the extracted data validates against the caller's schema — an invalid
  schema (400 INVALID_EXTRACTION_SCHEMA) or a non-conforming model output (422
  STRUCTURED_OUTPUT_INVALID) never charges.
- **POST /v1/extract/structured/demo** — free 1/day/IP demo (quota shared across
  all demos), same POST-only shape as the paid route.
- **extract_structured_data** MCP tool: free preview reusing the shared quota;
  the exhausted-quota path points to the paid x402 endpoint.
- New root dependency `@anthropic-ai/sdk` (^0.70.1) and `ANTHROPIC_API_KEY` for
  the main Vercel app — separate from the Fly worker's own key/dependency used
  by worker/ai-summary.js.
- Discovery surfaces updated per the suite template: OpenAPI, llms.txt
  (including a Limitations note on the content/output caps), capabilities
  manifest (`content.extract-structured`), marketing highlights, robots.txt
  Allow, Bazaar discovery extension.

## 2.6.0 — 2026-07-19 — Screenshot & PDF Render (the Fly browser, sold by the frame)

### Added
- **GET /v1/screenshot?url=** ($0.01 USDC via x402 v2): real-Chromium PNG
  (default), JPEG, or PDF of one public page — device desktop|mobile,
  full_page=true for whole-page capture. Synchronous over the browser job
  queue: the request enqueues, the worker renders (SSRF-guarded, budgeted),
  and the binary comes back directly with an X-Render-Job header. Settles
  only when bytes are returned; 503/504/502 are free. Worker gains a
  `screenshot` job profile (worker/run-screenshot.js); worker-capacity
  logic shared with the deep tier via lib/deep/capacity.js.
- Discovery surfaces updated per the suite template: OpenAPI, llms.txt,
  capabilities manifest (`render.screenshot`), JSON-LD Offer, landing plan
  card (six-card ladder), robots.txt Allow, Bazaar discovery extension.

## 2.5.0 — 2026-07-19 — Safe Fetch (suite product 2, the fetcher sold directly)

### Added
- **GET /v1/fetch?url=** ($0.002 USDC via x402 v2, POST {url} variant paywalled
  identically): one public URL → raw text body + response metadata (final URL,
  status, selected headers — never cookies — byte count, timing) through the
  hardened safe-fetcher: SSRF guards incl. redirect re-validation, 15s timeout,
  5 redirects, 5MB cap, ports 80/443, text formats only. Settles only on success.
- **GET /v1/fetch/demo** — free 1/day/IP demo (quota shared across all demos).
- Discovery surfaces updated per the suite template: OpenAPI, llms.txt,
  capabilities manifest (`web.safe-fetch`), JSON-LD Offer, landing plan card,
  robots.txt Allow, Bazaar discovery extension.

## 2.4.0 — 2026-07-19 — Page-to-Markdown extraction (suite product 1)

### Added
- **POST /v1/extract** ($0.005 USDC via x402 v2, GET ?url= variant paywalled
  identically): one public page → readability-isolated Markdown, title,
  description, canonical URL, outbound links (max 200), word count. Same
  safe-fetch guarantees as the quick audit; settles only on success.
- **GET /v1/extract/demo** — free 1/day/IP demo (quota shared with
  /api/audit/demo) and MCP tool `extract_page_markdown` (same shared quota).
- Discovery surfaces updated everywhere per the suite template: OpenAPI,
  llms.txt, capabilities manifest (`content.extract-markdown`), JSON-LD Offer,
  robots.txt Allow, Bazaar discovery extension in the 402.

## 2.3.1 — 2026-07-18 — Real Bazaar route templates, agent-friendly robots.txt

### Fixed
- **Bazaar discovery `routeTemplate` was `":var1"`.** `withX402` hardcodes a
  `"*"` route pattern, which `@x402/extensions` normalizes to `:var1`, so the
  402 discovery extension advertised a meaningless route to catalogs. The three
  paid routes now use `withX402FromHTTPServer` with an explicit verbless path
  key (`/api/audit`, `/api/agent-readiness`, `/v1/audits`); static keys emit no
  `routeTemplate` at all and catalogs index the canonical path from
  `resource.url` instead. Keys are verbless because
  Next.js serves HEAD through the GET handler and a verb-scoped key would let
  HEAD probes reach the handler unpaid. Payment terms, prices, and route
  configs are unchanged; the demo route stays unwrapped and free.
- **robots.txt no longer disallows the product endpoints.** The audit endpoints
  (`/api/audit`, `/api/audit/demo`, `/api/agent-readiness`, `/v1/audits`,
  `/mcp`) are now explicitly Allowed (RFC 9309 longest-match-wins beats the
  `/api/` and `/v1/` Disallow prefixes), so robots-respecting agent HTTP tools
  can call them; unlisted internals (Stripe checkout/webhook, analytics) stay
  disallowed. `Host:` now emits a bare hostname, and `llms.txt` documents the
  robots intent.

## 2.3.0 — 2026-07-18 — Human card purchases, nonce CSP, friendly /mcp

### Added
- **Stripe $19 human Agent Readiness Report.** New `/agent-readiness/buy` page
  (target URL + email → hosted Stripe Checkout). `POST /api/checkout` creates a
  Checkout Session with a server-controlled $19 price. `POST /api/stripe/webhook`
  verifies the signature against the raw body, is idempotent per Checkout Session
  id (Supabase `stripe_purchases`, RLS on, `santos_worker` role), and on
  `checkout.session.completed` runs the **same** `auditAgentReadiness` code path
  the x402 tier uses, stores the report behind the deep tier's HMAC bearer-token
  mechanism, emails the buyer a private tokened link via Resend, and fires the
  Discord notifier as card revenue. `/agent-readiness/thanks` and a tokened human
  report view at `/agent-readiness/report/[id]`. x402 pricing and the worker are
  untouched.
- **Nonce-based CSP** via `proxy.js` (per-request nonce + `strict-dynamic`), so
  Next.js inline hydration scripts execute instead of being blocked (verified: 0
  console violations, client components interactive). `connect-src` now includes
  `https://api.santosautomation.com`; checkout pages additionally allow Stripe's
  origins. Static CSP removed from `next.config.js` for HTML routes; other
  security headers preserved and a `Permissions-Policy` added.
- **Friendly `GET /mcp`** — human explainer (JSON or HTML by `Accept`) linking to
  `/openapi.json`, `/llms.txt`, and the $19 buy page. MCP `POST` unchanged.

### Changed
- Landing pricing, `/agent-readiness/run`, and `/terms` present two tracks: agents
  pay $0.025 USDC via x402; humans buy the $19 report by card. `llms.txt` and the
  capability manifest document the human card path truthfully.

## 2.2.2 — 2026-07-18

- Make the standalone Agent Readiness service paid by default at $0.025 USDC per
  successful audit through x402 v2 on Base mainnet.
- Publish one validated price across the route, website, OpenAPI, JSON-LD, service
  and capability manifests, MCP, llms.txt, terms, and operator documentation.
- Close the free MCP execution bypass: `audit_agent_readiness` now validates input
  and returns the canonical paid HTTP handoff. The embedded Quick Audit object remains
  an explicitly lower-coverage preview.

## 2.2.1 — 2026-07-18

- Add resource-scoped Agent Readiness pricing analysis across public text, JSON-LD
  Offers, vendor capability manifests, and passive x402 v2 challenges.
- Normalize enforced USDC atomic amounts, report pricing evidence under
  `interfaces.pricing`, and fail consistency checks when public metadata contradicts
  live payment terms without treating distinct product tiers as conflicts.

## 2.2.0 — 2026-07-18

- Add versioned Agent Readiness analyzer, standalone endpoint, MCP tool, capability
  manifest, additive Quick Audit result, and opt-in Deep Page Audit module.
- Add applicability-aware scoring, strict passive-probe limits, public documentation,
  examples, and contract tests.
