# Santos Agent Readiness dogfood

Assessment date: 2026-07-17 (sanitized passive checks; no payment signature sent).

## Live baseline before this branch

- `https://www.santosautomation.com/` returned 200 and published descriptive HTML,
  image alt text, API selection guidance, limitations, pricing, and support.
- `https://api.santosautomation.com/api` returned 200 from Vercel with HSTS and CSP;
  its deployed manifest version was `2.0.0`.
- Live OpenAPI was 3.1.0 / API version 2.1.0 and described Quick and Deep audits.
- Live llms.txt was reachable and began with `# Santos Site Audit API`.
- An unpaid `POST /v1/audits` returned a valid x402 v2 402 challenge for 0.075 USDC
  on `eip155:8453`. No `PAYMENT-SIGNATURE` was created or sent, so worker completion
  was intentionally not tested.
- The live deployment did not yet expose the new Agent Readiness endpoint, capability
  manifest, OpenAPI operation, MCP tool, or deep module. This is expected because this
  branch was not deployed at baseline time.

## Branch fixes and local verification

- `/llms.txt`, `/openapi.json`, `/api`, `/capabilities.json`, HTML link metadata, and
  `/mcp` now describe complementary canonical machine surfaces.
- OpenAPI exposes `auditAgentReadiness`; MCP exposes `audit_agent_readiness` with a
  strict input schema, output schema, structured content, and read-only annotations.
- The capability id is consistently `agent-readiness.quick` and the result schema is
  consistently `1.0.0`.
- Quick Audit receives Agent Readiness additively without changing its historical
  overall score formula.
- Deep Page Audit accepts the opt-in `agent-readiness` module and keeps its historical
  overall score formula unchanged.
- Local contract and route smoke tests passed. Production verification of these new
  surfaces remains pending deployment of this branch.
