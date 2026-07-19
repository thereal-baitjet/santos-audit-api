# Deep Page Audit — architecture & operations

## Architecture

```
Agent ── x402 $0.225 ──> Vercel control plane (POST /v1/audits)
                              │  validates target, idempotency, creates job row
                              ▼
                         Postgres (Supabase or any PG)
                          audit_jobs / events / reports / artifacts
                              ▲  FOR UPDATE SKIP LOCKED lease + heartbeat
                              │
                         Fly.io worker (isolated Chromium container)
                          Playwright evidence pass (SSRF-guarded per request)
                          → axe-core (rendered) → Lighthouse (CDP) → aggregate
                          → report + artifacts written back
```

- **Trust boundary:** the worker holds only `DATABASE_URL` (+ optional
  `ANTHROPIC_API_KEY`). Payment/facilitator/Vercel secrets never reach it.
- **Queue semantics:** atomic lease (`SKIP LOCKED`), visibility timeout
  (`WORKER_JOB_TIMEOUT_SECONDS`), attempt cap (`WORKER_MAX_ATTEMPTS`),
  heartbeats per stage, cancellation checks between stages, reaper in
  `store.cleanup()`.
- **Payment contract:** $DEEP_AUDIT_PRICE_USDC buys one bounded compute
  reservation; x402 settlement fires on the 201 accept. Idempotency-Key
  replays return 409 with the existing job and are NOT charged (>=400
  responses never settle).
- **Authorization:** job ids are unguessable AND every read needs the
  one-time `access_token` (stateless HMAC). Artifacts use 15-minute signed
  URLs.

## Go-live checklist (owner actions)

1. **Postgres** — create a Supabase project (or any Postgres), grab the
   pooled connection string. Tables auto-create on first use
   (`db/migrations/001_deep_audit.sql`).
2. **Vercel env** (santos-api project): `DATABASE_URL`,
   `REPORT_ACCESS_TOKEN_SECRET` (random 32+ chars), `IDEMPOTENCY_HASH_SECRET`
   (random 32+ chars), `DEEP_AUDIT_ENABLED=true`. Redeploy.
3. **Fly.io** — `fly launch --no-deploy -c worker/fly.toml` (creates app
   `santos-audit-worker`), then:
   `fly secrets set -c worker/fly.toml DATABASE_URL=... ANTHROPIC_API_KEY=...`
   then `fly deploy -c worker/fly.toml --dockerfile worker/Dockerfile`
   (run from the repo root — the build needs `lib/` and `db/`).
4. **Smoke test** — create a paid job (buy-deep.js or an x402 client), watch
   `fly logs`, poll `status_url`, fetch the report.

## Security model

- Control plane rejects private/reserved/metadata targets, bad schemes/ports,
  oversized URLs at job creation (free). The worker re-validates at execution
  time (DNS may change between accept and run).
- The Playwright evidence pass routes EVERY browser request (subresources,
  iframes; service workers are blocked outright; popups closed; downloads
  disabled) through `worker/browser-guard.js`: scheme/port allowlist,
  private-IP blocking with per-host DNS verdicts, request-count and byte caps.
- **Known limitation:** the Lighthouse pass drives Chromium over CDP and is
  not per-request filtered. Defense in depth: run the Fly app in its own
  dedicated Fly organization so its private network (6PN) contains nothing
  else, and treat worker egress as untrusted.
- Artifacts: cookie values, request bodies, and auth headers are never
  captured; URLs in evidence are redacted to scheme+host+path.

## Cost & limits (initial settings)

- One job at a time per worker machine (`shared-cpu-2x`, 2GB). Measured local
  run: ~9s for a small page; budget 30–120s typical, 300s hard cap.
- Artifacts capped at 3MB each (6MB for Lighthouse reports), 72h retention.
  Reports 30 days. Tune with `MAX_ARTIFACT_BYTES` / migration defaults.
- Scale = add Fly machines; SKIP LOCKED leasing keeps them from colliding.

## Explicitly out of scope in this release

Site crawls (multi-page), monitoring/comparisons, CrUX field data, desktop
Lighthouse second pass, PDF/HTML rendered reports, webhooks (callback_url is
rejected), active security scanning (passive only, by design), object-storage
artifacts (Postgres bytea for now).
