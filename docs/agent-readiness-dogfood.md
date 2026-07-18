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

## Production verification

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
- The first production self-audit returned 73/C, level 4, 71% tested coverage,
  and used 7/8 requests. It found one failed trust check because terms/privacy/
  retention guidance was not discoverable, and treated the explicit MCP anchor as
  medium-confidence evidence.
- The follow-up published /terms, linked it from HTML and llms.txt, added
  termsOfService to WebAPI JSON-LD, and treated explicitly linked MCP URLs as
  high-confidence advertisements.
- The final production self-audit returned **100/A**, level 4 Transaction-ready,
  75% tested coverage, 7/8 requests used, and zero failed findings. MCP advertising
  and terms/privacy both passed. The passive x402 evidence confirmed
  payment_signature_sent was false.
- A final unpaid Deep Audit request with the agent-readiness module returned a
  valid x402 v2 402 challenge for 0.075 USDC on eip155:8453; Bazaar metadata
  included the module. No payment signature was sent, so paid worker completion
  remains intentionally unverified.
- Vercel production checks passed. The standalone Fly worker source and dependency
  manifest are updated, but the Fly image still requires a separate owner deployment.
