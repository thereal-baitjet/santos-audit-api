# Santos Automation — Launch Checklist (site + audit API)

## Current state (2026-07-15)
- Live site: santosautomation.com on **Vercel** (etag 33f63ee...; deploy source repo not identified —
  none of santos-automation / santosautov3 / SantosAutomation2026 match the live HTML.
  Likely deployed from a local folder or another Vercel project. **Juan: check vercel.com dashboard → project → Git settings.**)
- New landing page + audit API: `~/projects/santos-audit-api/`
  - `site/index.html` — dev copy (API → localhost:4030)
  - `deploy/index.html` — production copy (API → api.santosautomation.com, full SEO pack)
  - `deploy/vercel.json` — security headers (fixes HSTS/CSP audit findings)
  - `server.js` + `audit.js` — the API (test: `npm run test`, 9/9)

## Step 1 — Deploy the new landing page (Vercel)
Option A (dashboard): drag-drop `deploy/` folder into the existing Vercel project, or point the
project at a repo containing these files.
Option B (CLI):
```bash
npm i -g vercel && vercel login        # interactive — Juan does this once
cd ~/projects/santos-audit-api/deploy && vercel --prod
```
Keep existing assets: the page references /assets/santos-logo.png from the current deployment —
copy the `assets/` folder from the old deployment into `deploy/` before shipping.

## Step 2 — Expose the audit API as api.santosautomation.com
On the Mac mini (or this Mac until then):
```bash
brew install cloudflared
cloudflared tunnel login                       # interactive — opens browser
cloudflared tunnel create santos-api
cloudflared tunnel route dns santos-api api.santosautomation.com
```
`~/.cloudflared/config.yml`:
```yaml
tunnel: santos-api
credentials-file: /Users/juansantos/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: api.santosautomation.com
    service: http://localhost:4030
  - service: http_status:404
```
Run: `cloudflared tunnel run santos-api` (later: `brew services start cloudflared`)
NOTE: DNS is at registrar-servers.com (Namecheap) — domain must be moved onto Cloudflare DNS
first (free plan), or use Vercel rewrite `/api/*` → tunnel URL as an alternative.

## Step 3 — Go-live switches (real money)
- `.env`: `X402_NETWORK=base` (mainnet) + `SELLER_ADDRESS=<Juan's real wallet>`
- Landing page + server manifest already quote $0.10/call.
- Keep the testnet copy running separately if we want a sandbox.

## Step 4 — Keep-alive on the Mac mini
- `node server.js` under launchd or pm2 (`npm i -g pm2; pm2 start server.js; pm2 save; pm2 startup`)
- cloudflared as a service (brew services)
- Hermes cron watchdog: poll /  every 5 min, alert if down.

## Verification after deploy
1. https://santosautomation.com → new page, audit widget works (CSP allows api.* connect)
2. curl -I https://santosautomation.com | grep -i strict-transport  → header present
3. https://api.santosautomation.com/ → manifest JSON
4. curl "https://api.santosautomation.com/audit/demo?url=example.com" → report
5. curl -o /dev/null -w "%{http_code}" "https://api.santosautomation.com/audit?url=example.com" → 402
6. Re-run own audit: overall score should jump (SEO + security fixes) from 74 → 90+
