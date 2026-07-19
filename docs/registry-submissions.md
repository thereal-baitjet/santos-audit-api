# Registry submissions — copy-ready listing data

Every field below is consistent with the deployed implementation. Items marked
**[manual]** require the owner's account, wallet signature, or domain access —
none of them have been submitted yet.

## Canonical listing copy (use everywhere)

- **Name:** Santos Site Audit API
- **Short description:** A machine-payable API that audits public websites for performance, SEO, accessibility, and security.
- **Long description:** Santos Site Audit API gives AI agents and automated workflows a structured technical review of a public website. It returns category scores, detailed checks, detected issues, and actionable remediation recommendations. Production audits cost $0.015 USDC on Base through x402, with no user account or traditional API key required.
- **Category:** Website analysis / developer tools
- **Price:** $0.015 USDC per audit
- **Network:** Base mainnet (eip155:8453)
- **Authentication:** x402 v2 payment authorization (`PAYMENT-SIGNATURE` request header / `PAYMENT-RESPONSE` receipt header)
- **Canonical endpoint:** https://api.santosautomation.com/api/audit
- **OpenAPI:** https://api.santosautomation.com/openapi.json
- **llms.txt:** https://api.santosautomation.com/llms.txt
- **MCP:** https://api.santosautomation.com/mcp
- **Support:** baitjet@gmail.com · https://santosautomation.com

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
- Logo: `public/assets/santos-logo.png` (serve as https://api.santosautomation.com/assets/santos-logo.png).

## 3. Official MCP Registry **[manual]**

- Repo: https://github.com/modelcontextprotocol/registry — publish via its CLI.
- Server name suggestion: `com.santosautomation/site-audit`
- Remote endpoint: `https://api.santosautomation.com/mcp` (transport: streamable-http)
- Requires domain or GitHub ownership verification through the registry's
  `mcp-publisher` CLI flow.

## 4. GitHub repository settings **[manual]**

- Description: `$0.015 x402 website audit API for AI agents, covering performance, SEO, accessibility, and security with no traditional API key.`
- Topics: `x402`, `ai-agents`, `website-audit`, `seo-api`, `accessibility`, `web-security`, `openapi`, `mcp-server`, `base`, `usdc`
- Note: the repo is currently **private**; listings that link to it should
  either omit the repo link or the repo should be made public first.

## 5. DNS for api.santosautomation.com — done (2026-07-17)

CNAME `api -> cname.vercel-dns.com` is live, the domain is attached to the
Vercel project, HTTPS is verified, and `PUBLIC_API_BASE_URL` is set in
Production and Preview. All canonical URLs in this document are current.

## Agent Readiness capability copy (publish only after live verification)

- **Capability ID:** `agent-readiness.quick`
- **Name:** Santos Agent Readiness Audit
- **Description:** Bounded passive assessment of how well agents can discover,
  understand, select, invoke, and—where explicitly applicable—pay for a public
  website or service. Applicability-aware; no login, payment, forms, business-tool
  invocation, or active security testing.
- **Canonical endpoint:** `GET https://api.santosautomation.com/api/agent-readiness?url={url}&depth=quick`
- **OpenAPI operation:** `auditAgentReadiness`
- **MCP tool:** `audit_agent_readiness`
- **Result schema:** `AgentReadinessResult` 1.0.0
- **Capability manifest:** https://api.santosautomation.com/capabilities.json
- **Price:** $0.075 USDC per successful audit through x402 v2 on Base mainnet
  (`amount: "75000"`, billing unit: successful response).

The official MCP Registry submission remains a manual owner action. Do not claim
publication until the listing is externally visible and domain ownership is verified.
