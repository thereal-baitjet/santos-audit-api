# Changelog

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
