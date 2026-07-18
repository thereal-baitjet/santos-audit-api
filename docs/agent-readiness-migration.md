# Agent Readiness migration notes

This release is additive for existing Quick Audit clients.

- Quick report `schema_version` is now `2.1.0`.
- Quick reports include `agent_readiness` when `AGENT_READINESS_ENABLED` is not
  `false`. The established `overall_score` remains the mean of performance, SEO,
  accessibility, and security only.
- Clients that reject unknown response properties should update their decoders before
  deployment. Tolerant JSON clients require no change.
- The new standalone route is `GET /api/agent-readiness?url=...&depth=quick` and emits
  `AgentReadinessResult` schema version `1.0.0`.
- Deep Page callers may opt in with `modules: ["agent-readiness"]`. The module is not
  added to existing defaults and does not change the historical deep `scores.overall`.
- MCP clients may continue using `audit_website_preview`; `audit_agent_readiness` is a
  new read-only tool. The server now negotiates MCP `2025-11-25` while retaining the
  two previously supported versions.
- The dedicated endpoint is paid at `0.025` USDC per successful response through x402
  v2. `AGENT_READINESS_PRICE_USDC` may override that default with another positive
  value of at most six decimal places; invalid values fail the build rather than
  advertising unenforced terms.
- The MCP `audit_agent_readiness` tool no longer executes the full standalone audit for
  free. It validates the target and returns the canonical paid HTTP handoff. The
  zero-additional-request Quick Audit object remains a lower-coverage embedded preview.
- Agent-commerce results now include an additive `interfaces.pricing` object with
  normalized claims, enforced challenge terms, missing fields, and resource-scoped
  contradictions. Existing fields and category weights are unchanged.
