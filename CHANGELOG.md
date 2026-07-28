# Changelog

## 2.14.0 — 2026-07-28 — Free-tier quota identity

### Added
- **The three free MCP tools accept an optional `token`.** `audit_website_preview`,
  `extract_page_markdown`, and `extract_structured_data` now take a verified-email
  token (the existing `/api/leads/verify/*` flow, valid 30 days) and key the daily
  free quota on that user instead of on the caller IP.

### Why
- IP is the wrong identity for a hosted agent. Grok — and any platform calling this
  server from its own infrastructure — egresses from a small set of shared
  addresses, so an IP-keyed quota is **one free call per day for that platform's
  entire user base**. Raising the per-IP limit would not have fixed it: the number
  was never the constraint, the identity was.

### Security
- A token that does not verify is **rejected outright**, never silently downgraded
  to the IP allowance. Falling back would have made a junk token a way to keep
  calling after an address had spent its quota.
- Email and IP keys live in separate namespaces, and both are HMAC-hashed before
  they are used as storage keys — no raw identity is persisted.

### Changed
- `/integrations/grok` documents the token flow and carries a copyable sample
  prompt; `llms.txt` and the free tool descriptions state the quota identity
  precisely. README gains a Grok Remote MCP badge.
- `lib/demo-limit.js` exports `dailyEmailKey` and `resolveFreeQuota`; the
  verified-email audit route now shares that key builder instead of defining its own.

## 2.13.0 — 2026-07-28 — Grok & xAI Remote MCP integration

### Added
- **`/integrations/grok`** — the Grok integration guide. Grok supports Remote MCP
  tools and Santos already publishes a public MCP server over Streamable HTTP, so
  this is a discovery and developer-experience surface, not a new backend
  capability. Covers the one-line `xai_sdk` registration, the seven tools Grok
  sees, the free-preview path that needs no wallet, and the handoff pattern for
  paid tools.
- **Capability manifest declares MCP client compatibility**: new `mcp_transport`
  (`streamable-http`) and `mcp_clients` fields, so an agent can confirm Grok
  compatibility from the manifest without parsing prose.
- **`llms.txt` gains an `## MCP clients` section** carrying the exact registration
  snippet, plus an integration-guide link under Machine surfaces.
- `/docs` gains a **Grok & xAI** section and table-of-contents entry.
- The guide is linked from primary navigation, the homepage integration grid, the
  footer developer links, and the sitemap.

### Notes
- No new endpoints, no pricing changes, and no change to how payment settles. Paid
  MCP tools continue to return the canonical x402 request rather than settling it —
  the calling agent holds the key and performs settlement.

## 2.12.0 — 2026-07-28 — Scoring accuracy: pricing attribution and paid-resource selection

### Fixed
- **Prices no longer bind to a neighbouring route.** The pricing extractor took
  a symmetric ±220-character window around a price and used the *first* URL in
  it. In a catalogue list — `/api/audit` at $0.015 on one line, `/api/audit/batch`
  at $0.50 on the next — the batch price reached back into the previous line and
  was recorded as the documented price of `/api/audit`, contradicting the
  enforced price. Any API whose routes share a path prefix was affected. A price
  now binds to the closest URL on either side with no *other* price between the
  two.
- **Illustrative rates are no longer read as competing prices.** `$0.50 flat per
  batch ($0.01/URL at full capacity)` was recorded as a second price for the same
  route. A price inside parentheses on a line that already states one outside
  them is an illustration, not a claim.
- **A pricing contradiction now requires enforced terms.** Grouping claims by
  resource URL and treating the first as authoritative meant a single URL selling
  more than one product — a checkout page with a $9 and a $29 report — was
  reported as contradicting itself. A contradiction is only raised against an
  actual x402 challenge, which is what "enforced" has always meant.
- **Paid-resource probing selects a real endpoint.** The probe could pick
  `openapi.json` — a free specification document — and then report that the paid
  resource returned no valid challenge when it answered 200. Specification and
  documentation artifacts are now excluded, a resource carrying a real x402 price
  outranks a link whose label merely mentions payment, and display placeholders
  (`?url=…`) are stripped before probing.

### Changed
- Santos Index: **santosautomation.com re-audited at 100** (was 94, audited
  2026-07-26). The site itself did not change — three of its findings were
  false positives produced by the defects above, which had depressed the
  agent-commerce and structured-identity subscores. The same corrected engine
  scores every domain in the index, and the index average is unchanged at 59.6
  across 311 domains.

### Added
- **Tiered human reports by card**: the retired $5 report is replaced by two
  one-time tiers at `/agent-readiness/buy` — **Quick Agent Readiness Report
  ($9 USD)**, fetch-based evidence, and **Deep Website Intelligence Report
  ($29 USD)**, browser-rendered (Lighthouse, axe-core, screenshots, network
  evidence). Both are formatted, emailed as private tokened links, and
  verifiable. Framing is now explicit site-wide: x402 prices are the agent
  price (raw API); card prices are the human report (formatted, emailed,
  verifiable).
- **Santos Monitoring** (`/monitoring`, $9 USD/month by card): weekly re-audit
  of one URL with the same engine, an email alert when the score moves 5+
  points, and a monthly digest when stable. Every monitoring email carries a
  manage link; cancellation stops re-audits and future charges immediately.
- **Lifecycle emails with index comparison**: report and monitoring emails
  show the score alongside the Santos Index average so owners can see where
  they stand against 300+ public reports.
- **Daily cron**: scheduled weekly re-audits, regression alerts, and digests
  for active monitoring subscriptions.
- Human checkout CTAs site-wide: homepage, docs, MCP explainer, and widgets
  point to `/agent-readiness/buy` and `/monitoring`.
- Terms: monitoring subscription terms (monthly renewal, cancel anytime via
  the manage link, alerts are informational, not an SLA).

### Changed
- The Santos Index now covers **310+ public reports**; site copy updated from
  "200+" to "300+" (homepage, /reports metadata, index findings guide).
- Capability manifest `human_purchase` now lists all three card products
  (Quick $9, Deep $29, Monitoring $9/mo).
- Version pins bumped to 2.11.0: `/version`, `/api` manifest, OpenAPI info,
  capability manifest, MCP serverInfo, server.json, and tests.

## 2.10.0 — 2026-07-26 — Feed Parser, Link Map, and Summarizer

### Added
- **Santos Feed Parser** (`GET/POST /v1/feed`, $0.003 USDC via x402 v2, env
  `FEED_PRICE_USDC`): one public feed URL to normalized JSON. Detects RSS 2.0,
  Atom, and JSON Feed through the same SSRF-guarded fetcher as Safe Fetch;
  returns feed metadata plus up to 50 items (`id`, `title`, `url`,
  `published`, `summary`, `author`). A non-feed target returns 422 and never
  settles.
- **Santos Link Map** (`GET/POST /v1/links`, $0.003 USDC via x402 v2, env
  `LINKS_PRICE_USDC`): one HTML page to a categorized link map — every link
  (max 200) with a kind (internal or external) plus topic tags (docs, pricing,
  api, careers, social, feed) and per-category counts. A site-discovery step,
  not a crawler.
- **Santos Summarizer** (`POST/GET /v1/summarize`, $0.033 USDC via x402 v2, env
  `SUMMARIZE_PRICE_USDC`): one HTML page to a Claude-generated structured
  summary (`title`, `summary`, `key_facts`, `entities`, `word_count`) with an
  optional `focus` steering prompt. Non-HTML targets return 422 and never
  settle.
- **MCP tools** `feed_parse`, `link_map`, and `summarize`: each validates the
  target and returns the canonical x402 HTTP handoff for its paid endpoint —
  MCP never executes or settles the paid call.
- Buyer examples: `buy-feed.js`, `buy-links.js`, `buy-summarize.js`.
  Discovery surfaces updated per the suite template: OpenAPI, llms.txt,
  capabilities manifest (`content.feed-parse`, `content.link-map`,
  `content.summarize`), /api service manifest, and /docs.

## 2.9.0 — 2026-07-23 — Verified free tier, public reports, badge, signed reports

### Added
- **Verified-email free audit**: the browser widget now requires a one-time
  6-digit email confirmation; quota is 1 audit/day per verified email
  (`GET /api/audit/free`). Machine demo endpoints stay IP-based for agents.
- **Public reports + leaderboard**: opt-in public results at
  `GET /reports/<domain>` and `GET /reports` (paid audits opt in with
  `&public=1`).
- **Agent-Ready badge**: `GET /v1/badge?url=…` — free SVG shield with score,
  goes stale after 30 days.
- **llms.txt generator**: `GET /v1/llms-txt/demo` + `/llms-txt-generator`
  page, sharing the verified-email daily claim.
- **Signed reports**: all audit responses carry an HMAC-SHA256 `signature`;
  verify via `POST /v1/verify` or the `/verify` page.
- **CI recipe**: `examples/agent-readiness-ci.yml` + `.sh`, documented at `/ci`.

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
