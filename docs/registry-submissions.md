# Registry submissions — copy-ready listing data

Every field below is consistent with the deployed implementation. Items marked
**[manual]** require the owner's account, wallet signature, or domain access —
none of them have been submitted yet.

## Canonical listing copy (use everywhere)

- **Name:** Santos Site Audit API
- **Short description:** A machine-payable API that audits public websites for performance, SEO, accessibility, and security.
- **Long description:** Santos Site Audit API gives AI agents and automated workflows a structured technical review of a public website. It returns category scores, detailed checks, detected issues, and actionable remediation recommendations. Production audits cost $0.005 USDC on Base through x402, with no user account or traditional API key required.
- **Category:** Website analysis / developer tools
- **Price:** $0.005 USDC per audit
- **Network:** Base mainnet (eip155:8453)
- **Authentication:** x402 payment authorization (v1 headers: `X-PAYMENT` / `X-PAYMENT-RESPONSE`)
- **Canonical endpoint:** https://www.santosautomation.com/api/audit
- **OpenAPI:** https://www.santosautomation.com/openapi.json
- **llms.txt:** https://www.santosautomation.com/llms.txt
- **MCP:** https://www.santosautomation.com/mcp
- **Support:** baitjet@gmail.com · https://santosautomation.com

> When `api.santosautomation.com` DNS goes live, update the four URLs above
> before submitting anywhere that hasn't been submitted yet.

## 1. x402 Bazaar / CDP discovery — automatic

The 402 response already carries `discoverable: true` plus input/output schemas
(set in `app/api/audit/route.js`). The Coinbase facilitator indexes discoverable
resources as they process payments — no form to fill.

**Verify indexing:** after real payments settle, check
`https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources` (or the
current CDP Bazaar listing UI) for the resource URL.

## 2. x402scan / x402 ecosystem directory **[manual]**

- Site: https://www.x402scan.com (and the ecosystem list at https://www.x402.org/ecosystem)
- Submit the canonical listing copy above. Typically requires: resource URL,
  description, category, and sometimes a signature from the receiving wallet
  (`0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B`) to prove ownership.
- Logo: `public/assets/santos-logo.png` (serve as https://www.santosautomation.com/assets/santos-logo.png).

## 3. Official MCP Registry **[manual]**

- Repo: https://github.com/modelcontextprotocol/registry — publish via its CLI.
- Server name suggestion: `com.santosautomation/site-audit`
- Remote endpoint: `https://www.santosautomation.com/mcp` (transport: streamable-http)
- Requires domain or GitHub ownership verification through the registry's
  `mcp-publisher` CLI flow.

## 4. GitHub repository settings **[manual]**

- Description: `$0.005 x402 website audit API for AI agents, covering performance, SEO, accessibility, and security with no traditional API key.`
- Topics: `x402`, `ai-agents`, `website-audit`, `seo-api`, `accessibility`, `web-security`, `openapi`, `mcp-server`, `base`, `usdc`
- Note: the repo is currently **private**; listings that link to it should
  either omit the repo link or the repo should be made public first.

## 5. DNS for api.santosautomation.com **[manual]**

At the DNS host for santosautomation.com (currently registrar-servers.com /
Namecheap): add `CNAME api -> cname.vercel-dns.com`, then add the domain to the
Vercel project (`vercel domains add api.santosautomation.com`) and set
`PUBLIC_API_BASE_URL=https://api.santosautomation.com` in Vercel env vars and
redeploy. Do not update registry listings until HTTPS on the new hostname is
verified.
