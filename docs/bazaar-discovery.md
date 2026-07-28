# x402 Bazaar discovery — root cause, fix, and verification

Why only one of eleven paid Santos endpoints was appearing in Agentic Market /
the CDP Bazaar catalog, what changed, and how to reproduce the evidence.

## Root cause

The x402 SDK derives a resource's catalog identity from the **live request URL**
unless the route pins one. From `@x402/core` (both `server/index.js:2052` and
`http/index.js:280`):

```js
url: routeConfig.resource || enrichedContext.adapter.getUrl(),
```

No Santos route set `resource`, so every route fell through to `adapter.getUrl()`
— the full request URL **including the query string**. Because every paid Santos
endpoint is driven by a `?url=` target, each caller minted a *different*
`resource.url` for the same endpoint:

```
GET /v1/fetch?url=https://example.com
  -> resource.url = https://api.santosautomation.com/v1/fetch?url=https%3A%2F%2Fexample.com

GET /v1/fetch?url=https://acme.io
  -> resource.url = https://api.santosautomation.com/v1/fetch?url=https%3A%2F%2Facme.io
```

The URLs were *distinct*, but never *stable*. The Bazaar indexes on settlement
and keys on `resource.url`, so no query-driven endpoint ever accumulated a
durable catalog entry. The four POST-only routes (`/v1/extract/structured`,
`/v1/summarize`, `/v1/audits`, `/api/audit/batch`) have no query string and so
emitted a stable URL — which is why some, but not all, endpoints could index.

Two secondary defects were found in the same pass:

1. **Incoherent request descriptors.** Five routes declared
   `bodyType: "json"` (body-style discovery) but are called with `GET`. The
   Bazaar extension overwrites `info.input.method` with the live request method
   (`bazaar/index.js:390`), producing a descriptor that says *"GET, with this
   JSON body"* — a shape no client can replay, since the real input is a query
   parameter.
2. **Silently dropped tags.** `sanitizeTags` caps tags at `MAX_TAGS = 5`.
   `/v1/audits` declared 6 and `/api/audit/batch` declared 7, so the overflow
   never reached the catalog. No route set `iconUrl` at all.

Route descriptions were checked and are all within CDP's ~500 character verify
limit (longest: `/v1/fetch` at 445), so that was not a contributing factor.

## The fix

`lib/bazaar-catalog.js` is the single source of truth for all eleven paid
resources. Each route spreads `bazaarResourceMeta("<id>")` into its config,
which supplies:

- `resource` — the canonical, **query-free** URL, pinned so identity no longer
  varies per caller
- `serviceName` — `Santos Website Intelligence`
- `iconUrl` — `https://www.santosautomation.com/apple-icon.png`
- `tags` — 2–5 specific ASCII tags, within the Bazaar cap, returned as a fresh
  array per call so no route can mutate another's listing

Routes serving both `GET` and `POST` now register **one resource server per
verb** — query-param discovery for `GET`, JSON-body discovery for `POST` — both
pinned to the same canonical `resource.url`, so they remain a single catalog
resource with a replayable request shape for each verb.

The base host is overridable via `X402_RESOURCE_BASE_URL` (default
`https://api.santosautomation.com`) so preview deploys can advertise themselves
instead of polluting the production catalog.

### The eleven canonical resources

| Method(s) | Route | `resource.url` |
| --- | --- | --- |
| GET, POST | `/v1/fetch` | `https://api.santosautomation.com/v1/fetch` |
| GET, POST | `/v1/extract` | `https://api.santosautomation.com/v1/extract` |
| POST | `/v1/extract/structured` | `https://api.santosautomation.com/v1/extract/structured` |
| GET | `/v1/screenshot` | `https://api.santosautomation.com/v1/screenshot` |
| GET, POST | `/v1/feed` | `https://api.santosautomation.com/v1/feed` |
| GET, POST | `/v1/links` | `https://api.santosautomation.com/v1/links` |
| GET, POST | `/v1/summarize` | `https://api.santosautomation.com/v1/summarize` |
| POST | `/v1/audits` | `https://api.santosautomation.com/v1/audits` |
| GET | `/api/audit` | `https://api.santosautomation.com/api/audit` |
| POST | `/api/audit/batch` | `https://api.santosautomation.com/api/audit/batch` |
| GET | `/api/agent-readiness` | `https://api.santosautomation.com/api/agent-readiness` |

### Routes deliberately *not* registered

`/v1/audits/[id]`, `/v1/audits/[id]/report`, and `/v1/artifacts/[artifactId]`
carry no x402 paywall — they are token-gated retrieval of work already paid for
via `POST /v1/audits`. They do not independently return payment requirements, so
they are not registered as purchasable Bazaar products. No dynamic-route
discovery is declared anywhere; all eleven paid products are static paths.

### Facilitator

Production settles through the Coinbase CDP facilitator
(`https://api.cdp.coinbase.com/platform/v2/x402`, via
`createFacilitatorConfig` in `lib/x402-server.js`) — not x402.org or any other
facilitator.

## Verification

### Automated test

```bash
node --test tests/bazaar-discovery.test.js
```

Runs static invariants offline: eleven routes, eleven unique query-free
canonical URLs, tag limits, per-verb input shapes, no shared mutable metadata,
and a source check that every route file pins its own catalog entry.

Add a base URL to also send an unpaid-but-valid request to all eleven routes and
assert the live 402 challenge:

```bash
BAZAAR_VERIFY_BASE_URL=https://api.santosautomation.com \
  node --test tests/bazaar-discovery.test.js
```

### Verification report

```bash
node scripts/verify-bazaar-discovery.js                 # unpaid probe, free
node scripts/verify-bazaar-discovery.js --json          # machine-readable
node scripts/verify-bazaar-discovery.js --paid          # REAL USDC settlements
```

Prints a table of method, route, `resource.url`, Bazaar input method/shape, and
Bazaar status, then asserts all eleven `resource.url` values are distinct. Exits
non-zero on any failure. `--paid` additionally settles a real payment per route
and decodes the `EXTENSION-RESPONSES` header to report the Bazaar
acknowledgement (`success` / `processing` / `rejected` plus `rejectedReason`);
it costs actual USDC and requires `BUYER_PRIVATE_KEY`.

Probe a preview deploy while still asserting production identity with
`--base <preview-url> --expect-base https://api.santosautomation.com`.

### Recorded before-state (production, 2026-07-28, pre-fix)

`node scripts/verify-bazaar-discovery.js` against the deployed 2.10.0 build:

```
METHOD  ROUTE                   RESOURCE.URL                                                             BAZAAR IN        OK
GET     /v1/fetch               .../v1/fetch?url=https%3A%2F%2Fexample.com                               GET/body         NO
GET     /v1/extract             .../v1/extract?url=https%3A%2F%2Fexample.com                             GET/body         NO
POST    /v1/extract/structured  .../v1/extract/structured                                                POST/body        NO
GET     /v1/screenshot          .../v1/screenshot?url=https%3A%2F%2Fexample.com                          GET/queryParams  NO
GET     /v1/feed                .../v1/feed?url=https%3A%2F%2Fexample.com%2Ffeed.xml                     GET/body         NO
GET     /v1/links               .../v1/links?url=https%3A%2F%2Fexample.com                               GET/body         NO
POST    /v1/summarize           .../v1/summarize                                                         POST/body        NO
POST    /v1/audits              .../v1/audits                                                            POST/body        NO
GET     /api/audit              .../api/audit?url=https%3A%2F%2Fexample.com                              GET/queryParams  NO
POST    /api/audit/batch        .../api/audit/batch                                                      POST/body        NO
GET     /api/agent-readiness    .../api/agent-readiness?url=https%3A%2F%2Fexample.com                    GET/queryParams  NO

routes probed: 11   routes passing: 0/11
```

Seven of eleven carried a query string in `resource.url`; five advertised a JSON
body for a `GET`; `/v1/audits` and `/api/audit/batch` exceeded the tag cap; none
set `iconUrl`.

Re-run the same command after deploying this branch to produce the after-state.
