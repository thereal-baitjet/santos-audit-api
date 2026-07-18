# Master Prompt — Human Payments + Audit Fixes for santosautomation.com

Copy everything below this line into a fresh Claude Code session started in `~/santos-audit-api`.

---

You are working in `~/santos-audit-api`, the repo behind www.santosautomation.com (landing) and api.santosautomation.com (API). It is a Next.js App Router project deployed to the Vercel project `santos-api` under the `thereal-baitjet` account, with a Supabase Postgres/queue (`santos-audit-deep`, project ref `sujjvmmghcsdmqsgzwzo`) and a Fly.io worker (`santos-audit-worker`, deployed from `worker/`) that runs deep browser audits.

## Current state (verified live 2026-07-18)

- Three x402 v2 paid tiers on Base mainnet (eip155:8453), USDC, no accounts/API keys:
  - Quick Intelligence: `GET /api/audit?url=…` — $0.005, sync (`app/api/audit/route.js`)
  - Agent Readiness: $0.025/success, human-facing run page at `/agent-readiness/run` (`app/agent-readiness/`, `lib/agent-readiness/`)
  - Deep Intelligence: `POST /v1/audits` — $0.075 reservation, async job via Supabase queue + Fly worker; deep report reads use a per-job bearer token (`app/v1/`, `lib/deep/`)
- Free daily demo: landing `#audit` widget → `/api/audit/demo` (1 scan/day/IP, `lib/demo-limit.js`, widget at `public/audit-widget.js`)
- x402 handling: `lib/x402-server.js`. Payments settle via Coinbase CDP facilitator (`CDP_API_KEY_ID`/`SECRET` in Vercel env). Discord webhook fires on settlements (`DISCORD_WEBHOOK_URL`).
- CSP and security headers are defined in `next.config.js`.

## The problem to solve

Every paid path requires a funded USDC wallet on Base. Humans (marketers, agencies, founders — the natural buyers of an "is my site AI-ready?" report) cannot pay. Stripe's ~$0.30 + 2.9% fee floor makes per-call card pricing impossible at $0.025, so the human product must be **value-priced and bundled**, not a card-mirror of x402 pricing.

## Task 1 — Stripe-paid Agent Readiness Report for humans (main deliverable)

Build a card-payment path that sells the **report**, not the API call:

1. **Product**: "Agent Readiness Report" — one-off, **$19 USD** via Stripe Checkout (hosted page). No account creation. Buyer enters the target URL + their email, pays, and receives an email linking to their report.
2. **Flow**:
   - New page `/agent-readiness/buy` (linked prominently from `/agent-readiness/run` and the landing pricing section): form with target URL + email → `POST /api/checkout` → create a Stripe Checkout Session (`mode: "payment"`, price data inline or a `STRIPE_PRICE_ID` env var, `metadata: { target_url }`, `customer_email`) → redirect to Stripe.
   - `POST /api/stripe/webhook`: verify signature with `STRIPE_WEBHOOK_SECRET` (use the raw request body), handle `checkout.session.completed` → enqueue the same agent-readiness job the x402 path uses (reuse the existing job/queue code paths — do NOT fork a parallel pipeline), tagging the job `payment_rail: "stripe"` with the session id.
   - On job completion, email the buyer a tokened report URL. Reuse the existing per-job bearer-token report-read mechanism from the deep tier. For email, use Resend (`RESEND_API_KEY`) with a plain, minimal template; sender `reports@santosautomation.com` if the domain is verified in Resend, otherwise fall back to `onboarding@resend.dev` and leave a TODO.
   - Success/cancel pages: `/agent-readiness/thanks` ("check your email, report usually ready in a few minutes") and cancel back to `/agent-readiness/buy`.
3. **Idempotency + safety**: webhook must be idempotent per Checkout Session id (store processed session ids — a small Supabase table is fine; follow the existing least-privilege pattern, RLS on, service access via the `santos_worker`-style role conventions in `db/`). Never trust amounts from the client; the price lives server-side only. Refunds are manual via email (consistent with existing terms — update `/terms` copy to mention card purchases and refund-by-email).
4. **Positioning copy**: on `/agent-readiness/buy` and the landing pricing section, present two tracks: "Agents: 0.025 USDC via x402, no account" and "Humans: $19 one-time report by card". Keep x402 untouched.
5. **Env vars** to add in Vercel (`santos-api`, thereal-baitjet account) and `.env.local.example`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Do not commit secrets. Print the exact `stripe listen`/dashboard steps the operator must do manually at the end.
6. Fire the existing Discord settlement webhook for Stripe purchases too, labeled as card revenue.

## Task 2 — Fix CSP vs. inline Next.js scripts

`next.config.js` sends `script-src 'self'` with no nonce. The landing page ships ~20 inline Next.js hydration scripts which real browsers **block** under this policy (confirmed live: injected inline scripts do not execute). The site survives only because it is SSR + a vanilla external widget, but every visitor gets console CSP violations, dead hydration bytes ship on every load, and any future React client component will silently fail.

Fix with **nonce-based CSP via `middleware.js`** (generate a nonce per request, set the CSP header there with `'nonce-…'` + `'strict-dynamic'` for script-src, remove the static CSP header from `next.config.js` for HTML routes; keep the other security headers). Verify hydration actually executes after the fix. If nonces prove impractical with the current rendering setup, the acceptable fallback is documenting the page as intentionally static and stripping client components — but try the nonce route first.

Also update `connect-src` to include `https://api.santosautomation.com` so future browser-side calls to the API origin aren't blocked, and add `https://checkout.stripe.com` / Stripe's required origins per Stripe's CSP docs for the pages that touch checkout (`form-action` must allow Stripe redirect; keep everything else locked down).

## Task 3 — Friendly GET on /mcp

`GET https://api.santosautomation.com/mcp` returns a bare 405 (correct for MCP streamable HTTP, but hostile to humans clicking the link from the capabilities manifest). Add a GET handler returning a small JSON or HTML explainer: what the endpoint is, that it speaks MCP over POST, and links to `/openapi.json` and `/llms.txt`. Keep POST behavior unchanged.

## Constraints

- Match existing code style (plain JS, no TypeScript migration).
- Do not modify x402 pricing, the worker, or the deep-tier payment reservation logic.
- Update `app/capabilities.json` route / `lib/capabilities.js`, `llms.txt` content, `openapi.json`, and landing copy (`lib/marketing-content.js`) wherever the new human purchase path or CSP behavior is user-visible, so the machine-readable surface stays truthful.
- Add a CHANGELOG.md entry.

## Acceptance criteria (verify each before finishing)

1. `stripe trigger checkout.session.completed` (or test-mode checkout) → job enqueued exactly once, report generated, email sent with a working tokened report URL; replaying the same webhook does not double-enqueue.
2. Live page loads with zero CSP violations in the browser console and Next.js hydration confirmed executing (e.g. a client component actually interactive, or `self.__next_f` populated by inline scripts under the enforced policy).
3. Free demo widget on `#audit` still works end-to-end.
4. `GET /api/audit?url=…` without payment still returns the same 402 + hint body.
5. `GET /mcp` returns the explainer; MCP POST clients unaffected.
6. `npm test` (and any existing test suites in `tests/`) pass; add tests for webhook idempotency and the checkout route's input validation (reject non-public/invalid URLs using the existing `lib/safe-fetch.js` validation conventions).
7. Run a local build (`npm run build`) clean before declaring done. Deploy is manual — stop and list the exact operator steps (Stripe dashboard product/webhook setup, Vercel env vars, Resend domain verification) rather than deploying yourself.
