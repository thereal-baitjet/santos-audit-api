# Registry submissions — copy-ready listing data

Every field below is consistent with the deployed implementation. Items marked
**[manual]** require the owner's account, wallet signature, or domain access.

**Status (2026-07-23):** the x402 Bazaar, x402scan, and official MCP Registry
tracks are **LIVE** — per `docs/suite-roadmap.md` ("Discovery is DONE": quick
tier auto-listed on the Bazaar, MCP registry published as
`com.santosautomation/site-audit`, x402scan carries all paid + public
endpoints), and MCP registry domain verification is complete
(`public/.well-known/mcp-registry-auth`). Their submission text below is kept
for reference and for refreshing the listings. The remaining **[manual]**
sections (GitHub metadata, Smithery, Glama, PulseMCP, Awesome lists) have not
been submitted yet.

## Canonical listing copy (use everywhere)

- **Name:** Santos Site Audit API
- **Short description:** A machine-payable API that audits public websites for performance, SEO, accessibility, and security.
- **Long description:** Santos Site Audit API gives AI agents and automated workflows a structured technical review of a public website. It returns category scores, detailed checks, detected issues, and actionable remediation recommendations. Production audits cost $0.005 USDC on Base through x402, with no user account or traditional API key required.
- **Category:** Website analysis / developer tools
- **Price:** $0.005 USDC per audit
- **Network:** Base mainnet (eip155:8453)
- **Authentication:** x402 v2 payment authorization (`PAYMENT-SIGNATURE` request header / `PAYMENT-RESPONSE` receipt header)
- **Canonical endpoint:** https://api.santosautomation.com/api/audit
- **OpenAPI:** https://api.santosautomation.com/openapi.json
- **llms.txt:** https://api.santosautomation.com/llms.txt
- **MCP:** https://api.santosautomation.com/mcp
- **Support:** baitjet@gmail.com · https://santosautomation.com

## 1. x402 Bazaar / CDP discovery — automatic — **LIVE**

The 402 response already carries `discoverable: true` plus input/output schemas
(set in `app/api/audit/route.js`). The Coinbase facilitator indexes discoverable
resources as they process payments — no form to fill. The quick tier is
auto-listed since real payments settled (see `docs/suite-roadmap.md`).

**Verify indexing:** after real payments settle, check
`https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources` (or the
current CDP Bazaar listing UI) for the resource URL.

## 2. x402scan / x402 ecosystem directory — **LIVE**

- Site: https://www.x402scan.com (and the ecosystem list at https://www.x402.org/ecosystem)
- Listing carries all 3 paid + 4 public endpoints (per `docs/suite-roadmap.md`).
  Submitted with the canonical listing copy above: resource URL, description,
  category, and a signature from the receiving wallet
  (`0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B`) to prove ownership.
- Logo: `public/assets/santos-logo.png` (serve as https://api.santosautomation.com/assets/santos-logo.png).

## 3. Official MCP Registry — **LIVE**

- Repo: https://github.com/modelcontextprotocol/registry — publish via its CLI.
- Server name: `com.santosautomation/site-audit` (published as v1.0.0; bump to
  match `server.json` on the next `mcp-publisher` run).
- Remote endpoint: `https://api.santosautomation.com/mcp` (transport: streamable-http)
- Domain ownership verified through the registry's `mcp-publisher` CLI flow;
  the verification token lives at `public/.well-known/mcp-registry-auth`.

## 4. GitHub repository settings **[manual]**

- Description: `$0.005 x402 website audit API for AI agents, covering performance, SEO, accessibility, and security with no traditional API key.`
- Topics: `x402`, `ai-agents`, `website-audit`, `seo-api`, `accessibility`, `web-security`, `openapi`, `mcp-server`, `base`, `usdc`
- Note: the repo is currently **private**; listings that link to it should
  either omit the repo link or the repo should be made public first.

## 5. Smithery (smithery.ai) **[manual]**

- Site: https://smithery.ai — MCP server directory; submit via the "Add Server"
  flow with the remote endpoint (no local install needed).
- Server name: `com.santosautomation/site-audit`
- Remote endpoint: `https://api.santosautomation.com/mcp` (transport: streamable-http)
- Description: `Website intelligence audits for AI agents: free preview plus x402-paid Agent Readiness scoring`
- Tools to list: `audit_website_preview` (free, 1/day per IP), `audit_agent_readiness`
  (paid handoff, 0.075 USDC via x402), `extract_page_markdown` (free preview),
  `extract_structured_data` (free preview).
- Categories/tags: `website-audit`, `seo`, `ai-agents`, `x402`, `extraction`

## 6. Glama (glama.ai) **[manual]**

- Site: https://glama.ai/mcp/servers — submit the server for indexing.
- Server name: `com.santosautomation/site-audit`
- Remote endpoint: `https://api.santosautomation.com/mcp` (transport: streamable-http)
- Description: `Website intelligence audits for AI agents: free preview plus x402-paid Agent Readiness scoring`
- Tools to list: `audit_website_preview` (free, 1/day per IP), `audit_agent_readiness`
  (paid handoff, 0.075 USDC via x402), `extract_page_markdown` (free preview),
  `extract_structured_data` (free preview).
- Links: website https://www.santosautomation.com · docs https://api.santosautomation.com/llms.txt
- Note: Glama cross-references the official MCP Registry entry and `server.json`
  at the repo root — both already exist.

## 7. PulseMCP (pulsemcp.com) **[manual]**

- Site: https://www.pulsemcp.com — submit via the "Submit a server" form.
- Server name: `com.santosautomation/site-audit`
- Remote endpoint: `https://api.santosautomation.com/mcp` (transport: streamable-http)
- Description: `Website intelligence audits for AI agents: free preview plus x402-paid Agent Readiness scoring`
- Tools to list: `audit_website_preview` (free, 1/day per IP), `audit_agent_readiness`
  (paid handoff, 0.075 USDC via x402), `extract_page_markdown` (free preview),
  `extract_structured_data` (free preview).
- Links: website https://www.santosautomation.com · OpenAPI https://api.santosautomation.com/openapi.json

## 8. Awesome lists **[manual]**

- PR the one-liner below to https://github.com/punkpeye/awesome-mcp-servers and
  https://github.com/modelcontextprotocol/servers (community servers section).
- One-line description: `Santos Site Audit API — website intelligence audits for AI agents: free preview plus x402-paid Agent Readiness scoring (remote: https://api.santosautomation.com/mcp).`
- Note: the repo is currently **private** (see section 4); awesome-list PRs
  should use the website/endpoint links, not the repo link.

## 9. DNS for api.santosautomation.com — done (2026-07-17)

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
  (`amount: "25000"`, billing unit: successful response).

The official MCP Registry entry is published and domain ownership is verified
(see the status note at the top). Any version bump in `server.json` still
requires a manual `mcp-publisher` re-run by the owner before it is externally
visible.
