# Agent Readiness standards baseline

Baseline reviewed 2026-07-17. The implementation deliberately separates formal
standards, proposals, preview services, and vendor-specific discovery metadata.

- MCP protocol: `2025-11-25`. The read-only probe may call only `initialize` and
  `tools/list`; it never calls `tools/call` on the audited target.
- OpenAPI: current published specification is 3.2.0. Santos continues to emit
  OpenAPI 3.1.0 for ecosystem compatibility; the analyzer accepts 3.0, 3.1, 3.2,
  and Swagger 2.0 JSON or YAML through the maintained `yaml` parser. Semantic
  validation remains bounded and structural, without remote `$ref` resolution or
  example execution.
- llms.txt: evaluated as a proposal. Absence is a discovery opportunity, not proof
  that an ordinary site is broken or non-compliant.
- MCP Registry: optional evidence only. The official registry is preview
  infrastructure; bounded lookups are feature-flagged and never establish identity
  by themselves.
- x402: version 2 challenge semantics. The auditor may request an advertised paid
  resource without payment solely to inspect a 402 challenge. It never creates or
  sends `PAYMENT-SIGNATURE` and never transfers funds.
- `santos-capability-manifest`: vendor-specific, versioned discovery metadata with
  `standard: false`; it is not represented as an external standard.

Primary references:

- https://modelcontextprotocol.io/specification/2025-11-25
- https://spec.openapis.org/oas/latest.html
- https://llmstxt.org/
- https://modelcontextprotocol.io/registry/about
- https://docs.x402.org/introduction
