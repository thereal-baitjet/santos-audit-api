# Santos Agent API Suite — Roadmap & Reference

*Written 2026-07-19. Self-contained: readable with zero conversation context. This is the strategy + build plan for expanding santosautomation.com from one audit API into a suite of x402 machine-payable capabilities for AI agents.*

---

## The one-sentence thesis

We've built a coin slot (x402 payment gate), a safe web-fetcher, and a cloud browser — the plan is to keep bolting new **read-only, one-shot, web-facing** capabilities onto them, cheapest-first, until the catalog does the marketing for us.

## The three assets everything reuses

1. **Payment turnstile** — `lib/x402-server.js`: a reusable x402 v2 gate (USDC on Base, eip155:8453, Coinbase CDP facilitator, seller wallet `0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B`). Put it in front of any route; it doesn't care what's behind the door. Settle-after-success: failed calls cost the buyer nothing.
2. **Safe web-fetcher** — `lib/safe-fetch.js` + validation conventions: SSRF protection (private/link-local/metadata addresses blocked, including via redirects), 15s timeout, 5 redirects, 5MB cap, ports 80/443 only. This is the hard 20% of every web API, already written and battle-tested.
3. **Rentable browser** — Fly.io worker `santos-audit-worker` (`worker/`): hardened Chromium/Playwright with navigation timeouts, request caps, byte budgets (`browser-guard.js`), fed by the Supabase job queue (`lib/deep/store.js`). Currently deep-audit-only, but a browser can do anything a browser does.

Plus the discovery stack every product plugs into: llms.txt (`public/llms.txt`), OpenAPI (`app/openapi.json/route.js`), capabilities manifests, MCP server (`app/mcp/route.js`), Bazaar discovery extension in every 402.

## Why a suite beats one great API

- Agents find services through **catalogs** (x402 Bazaar — fed automatically by our 402 extensions once payments settle — MCP registry, llms.txt). Each resource is a lottery ticket; eight small APIs under one seller wallet = eight tickets **plus cross-sell**: an agent that comes for a screenshot reads llms.txt and finds the audit, extractor, trust report.
- **x402 has no fee floor**, so we profitably sell at $0.005 where card rails can't operate. Competition at these prices isn't SaaS — it's the agent writing the code itself. We win when paying us half a cent beats the agent burning 30 seconds of tokens reimplementing it.
- Marginal cost of product N keeps falling because every product repeats the same checklist (see "The template" below). Product 2 should cost weeks; product 5 should cost a weekend.

## Build order

| # | Product | Route | Price | Reuses | Effort |
|---|---------|-------|-------|--------|--------|
| 1 | **Page-to-Markdown extractor** | `POST /v1/extract` | ~$0.005 | fetcher + audit engine minus scoring | Smallest — START HERE |
| 2 | Screenshot & PDF render | `GET /v1/screenshot` | ~$0.01 | Fly browser (subset of deep audit) | Small |
| 3 | STT + TTS (batch only) | `POST /v1/stt`, `/v1/tts` | ~$0.01/min, ~$0.02/1k chars | turnstile + upstream keys (Deepgram, OpenAI/Cartesia) | Medium — metered upstream cost |
| 4 | Domain Trust Report | `GET /v1/domain` | ~$0.01 | pure DNS/TLS lookups, zero upstream cost, extends "trust" brand | Small-medium |
| 5 | Structured extraction (LLM) | `POST /v1/extract/structured` | ~$0.01–0.03 | fetcher + ANTHROPIC_API_KEY (already wired in worker) | Medium — metered LLM cost |
| W | Onchain wallet/token intel | `GET /v1/wallet` | ~$0.01–0.05 | public RPCs; WhaleBlocks background | Wildcard — audience already holds wallets |

Fillers for catalog breadth (each ~a day): link unfurl (URL → og/title/image JSON), PDF-to-text, QR generation.

### Rules learned the hard way (do not skip)

- **Verbless route keys** with the x402 wrapper. `withX402()` from `@x402/next` hardcodes `{"*": config}` which produces `routeTemplate: ":var1"` in Bazaar discovery — use `withX402FromHTTPServer` + `x402HTTPResourceServer` with a verbless path key like `"/v1/extract"` (implemented across the existing paid routes — copy their pattern). Verb-scoped keys (`"GET /path"`) let HEAD requests bypass the paywall (Next maps HEAD→GET handler).
- **The CDP facilitator rejects echoed 402 blocks.** Standard x402 v2 clients echo the 402's `resource`/`extensions` blocks back in the payment payload, and CDP's verify schema 400s on them — every real payment failed until `lib/x402-server.js`'s `CDPFacilitatorClient` stripped those fields before verify/settle. That strip must stay; don't "clean up" that code.
- **Registry probers are fragile**: 402 must come *before* input validation on paid GET endpoints, non-x402 OpenAPI routes need explicit `security: []`, and `$defs`/`$ref` in response schemas can crash probers — inline refs in OpenAPI output.
- **Validate before charging** on anything with real marginal cost (LLM, STT/TTS upstream) — reject bad/oversized input before the payment challenge where possible (for paid GETs, the 402 fires first per the prober rule; validation then guards the *paid* retry), and a failed upstream call must never settle.
- **Body size limits**: Vercel caps request bodies (~4.5MB). Big inputs (audio, PDFs) → accept a URL input and fetch server-side through the safe fetcher, or use the async job pattern (`lib/deep/`).
- **Worker economics** (implemented 2026-07-20 as a two-layer model): Mac launchd agent `com.santosautomation.audit-worker` runs while the Mac is awake; Fly wake-per-job (`lib/deep/fly-wake.js`) starts the stopped machine when a paid job arrives (Fly account currently needs restoring — see memory). A `worker_heartbeats` table gates the paid deep tier: no fresh beat (<120s) → 503, no charge. **Never sell a tier whose executor is down** — reuse this heartbeat-gate pattern for any future worker-backed product.

### Hard NOs (liability/shape, not difficulty)

- **Nothing that sends on behalf of agents** — email, SMS, posting. Key-less + no-account + outbound = spam cannon with our name on it.
- **Nothing streaming or session-based** — live transcription, WebRTC, proxies. x402 pays per request; streams aren't requests. (WebRTC revisit-maybe as "pay → mint time-boxed room token" ONLY if STT/TTS prove voice demand.)
- **No licensed-data resells** — search results, geocoding, people data.
- Safe zone = **read-only, one-shot, web-facing**. Conveniently also where all three assets live.

## The template — checklist for EVERY new product

Adding a resource means all of these, every time (build once as a copy-paste pattern from product 1):

1. Route file under `app/v1/<name>/route.js` — plain JS, match existing style.
2. x402 wrapper: `withX402FromHTTPServer` + verbless route key + `routeConfig` with accepts/description/serviceName/tags/`unpaidResponseBody` hint + `declareDiscoveryExtension` (input schema, output example).
3. Input validation via `lib/safe-fetch.js` conventions, *before* payment.
4. OpenAPI path added (`app/openapi.json/route.js`).
5. llms.txt entry (`public/llms.txt`) — endpoint, price in USDC + atomic units, selection guidance ("choose X when…"), limitations.
6. Capabilities manifests (`lib/capabilities.js`, `.well-known/agent-capabilities.json`).
7. MCP tool if it deserves one (`app/mcp/route.js`) — free preview variant where feasible (the free-first funnel converts).
8. robots.txt `Allow` line for the new endpoint (`app/robots.js`).
9. Discord settlement notification (`notify.js`).
10. Tests in `tests/` + CHANGELOG entry.
11. After deploy: verify 402 decodes with correct `routeTemplate`, unpaid HEAD still 402s, demo/MCP unaffected.

## Product 1 spec: Page-to-Markdown extractor (start here)

**What it is:** agent sends a URL, gets back the page as clean markdown — no menus, ads, or cookie banners. The most-consumed capability in agent workflows (RAG, research agents). Firecrawl/Jina prove demand; our angle is key-less x402 access.

- **Route:** `POST /v1/extract`, body `{"url": "https://…"}` (also accept `GET /v1/extract?url=` for symmetry with `/api/audit`). Options later, not v1: `include_links`, `max_chars`.
- **Price:** $0.005 USDC (5000 atomic units) — the cheap high-volume entry product under the $0.015 quick audit. Sync, seconds.
- **Engine:** the quick-audit fetch path (fetch + cheerio) minus scoring, plus readability-style content extraction → markdown. Consider `@mozilla/readability` + `turndown` (check licenses; both permissive).
- **Response:** `{url, http_status, title, byline?, markdown, links?, word_count, fetched_at, timing_ms}` — mirror the audit response conventions (schema_version field, final URL after redirects).
- **Free tier:** 1/day/IP demo variant reusing `lib/demo-limit.js` (shared or separate quota — decide then document in llms.txt), + MCP free preview tool.
- **Failure = no charge:** unreachable target, non-HTML content, oversized page → clean error via `lib/errors.js` conventions, no settlement.
- **Acceptance:** decoded 402 shows `routeTemplate: /v1/extract`; paid flow verified via `buy-live.js`-style script (add `buy-extract.js`); markdown output sane on 3 real pages (news article, docs page, product page); all template checklist items done; `npm test` + `npm run build` clean.

## Current state snapshot (2026-07-19, post-launch)

- **Revenue is live**: 6 real USDC settlements on Base (1 deep + 5 agent-readiness). Prices after the 2026-07-19 tripling: quick $0.015, agent readiness $0.075 (+ $5 human Stripe report at `/agent-readiness/buy`), deep $0.225.
- **Discovery is DONE**: quick tier auto-listed on the x402 Bazaar, MCP registry published (`com.santosautomation/site-audit` v1.0.0), x402scan carries all 3 paid + 4 public endpoints. Every track in `docs/registry-submissions.md` is complete — new products get added to these same listings.
- Deep-tier execution: two-layer worker (Mac launchd + Fly wake-per-job) with heartbeat gate; Fly account needs restoring (org/billing) before the Fly layer works again.
- Buyer wallet `0xdf83…03C8` is funded (`.env.local` `BUYER_PRIVATE_KEY`) — use it for paid end-to-end tests of each new product (`buy-live.js` is the pattern; add a `buy-<product>.js` per product).

## Sequencing for the committed-but-slow path

1. Build product 1 (extractor) following the spec + template above. Price it against the *new* ladder (quick audit is $0.015; extract at ~$0.005 as the cheap high-volume entry product is coherent).
2. On ship: add it to llms.txt/OpenAPI/manifests (template), verify its Bazaar extension in the 402, submit/refresh x402scan listing, add an MCP free-preview tool, and run a paid end-to-end test with the funded buyer wallet.
3. Products 2, 4 (screenshot, domain trust) — smallest lifts, no metered upstream. Screenshot depends on restoring the Fly account (or runs via the Mac launchd worker meanwhile).
4. Product 3 (STT/TTS) once comfortable with metered-upstream patterns.
5. Revisit wallet intel / WebRTC-token only on demand signals.

No deadline. Each step is independently shippable and independently valuable. The suite compounds — every product makes the others more findable, and the catalog listings that already exist are the distribution channel every new product inherits on day one.
