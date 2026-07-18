export const AGENT_READINESS_SCHEMA_VERSION = "1.0.0";

export const CATEGORY_WEIGHTS = Object.freeze({
  discovery_and_documentation: 20,
  structured_identity_and_context: 15,
  api_readiness: 20,
  mcp_readiness: 25,
  operational_trust: 10,
  agent_commerce: 10,
});

export const READINESS_LEVELS = Object.freeze([
  { level: 0, name: "Human-only" },
  { level: 1, name: "LLM-readable" },
  { level: 2, name: "Machine-described" },
  { level: 3, name: "Tool-invokable" },
  { level: 4, name: "Transaction-ready" },
]);

export const CHECK_REGISTRY = Object.freeze([
  check("agent.llms_txt.present", "discovery_and_documentation", 4, "always", "Publish a concise /llms.txt that points to canonical machine interfaces."),
  check("agent.llms_txt.format", "discovery_and_documentation", 3, "llms", "Use the proposed llms.txt structure: H1, useful summary, H2 link sections, and an Optional section when needed."),
  check("agent.llms_txt.quality", "discovery_and_documentation", 4, "llms", "Explain capabilities, selection guidance, interfaces, pricing/access, limits, and support without overstating the proposal."),
  check("agent.discovery.links", "discovery_and_documentation", 2, "always", "Advertise canonical machine-readable interfaces from HTML or HTTP Link headers."),
  check("agent.docs.machine_readable", "discovery_and_documentation", 3, "always", "Provide low-noise public documentation in static HTML, Markdown, or a typed interface description."),
  check("agent.crawlability", "discovery_and_documentation", 2, "always", "Keep public machine documentation reachable and avoid accidental robots.txt blocking."),

  check("agent.jsonld.parseable", "structured_identity_and_context", 3, "always", "Fix invalid JSON-LD syntax; remote contexts are not required for this check."),
  check("agent.jsonld.identity", "structured_identity_and_context", 3, "always", "Publish consistent Organization, WebSite, Service, SoftwareApplication, or WebAPI identity metadata."),
  check("agent.jsonld.webapi", "structured_identity_and_context", 3, "api", "Describe the advertised API with Schema.org WebAPI or equivalent service metadata."),
  check("agent.jsonld.offer", "structured_identity_and_context", 2, "commerce", "When paid access is advertised, publish consistent machine-readable Offer or pricing metadata."),
  check("agent.metadata.consistency", "structured_identity_and_context", 4, "always", "Keep names, canonical URLs, prices, and interface claims consistent across public surfaces."),

  check("agent.openapi.discovery", "api_readiness", 3, "api", "Advertise a canonical OpenAPI document from public documentation or link metadata."),
  check("agent.openapi.valid", "api_readiness", 4, "openapi", "Publish parseable OpenAPI 3.x or Swagger 2.0 JSON/YAML with a canonical server."),
  check("agent.openapi.operations", "api_readiness", 3, "openapi", "Add stable operationId values plus meaningful summaries, descriptions, and tags."),
  check("agent.openapi.schemas", "api_readiness", 4, "openapi", "Describe typed inputs, outputs, examples, required fields, and non-2xx errors."),
  check("agent.openapi.auth_payment", "api_readiness", 2, "openapi", "Document authentication or payment requirements, networks, and settlement behavior."),
  check("agent.capabilities.manifest", "api_readiness", 2, "api", "Advertise a versioned capability description with inputs, outputs, cost, behavior, errors, limits, and docs."),

  check("agent.mcp.advertised", "mcp_readiness", 3, "mcp", "Advertise MCP through documentation, llms.txt, registry metadata, or an explicit endpoint link."),
  check("agent.mcp.registry", "mcp_readiness", 3, "mcp", "Publish the server in the official MCP Registry when public distribution is intended."),
  check("agent.mcp.transport", "mcp_readiness", 4, "mcp", "Expose a standards-compatible MCP transport and negotiate a current stable protocol version."),
  check("agent.mcp.tools", "mcp_readiness", 5, "mcp", "Expose deterministic tools with descriptions and strict input/output schemas."),
  check("agent.mcp.structured_output", "mcp_readiness", 3, "mcp", "Define outputSchema and return structuredContent with a compatible text fallback."),
  check("agent.mcp.authorization", "mcp_readiness", 2, "mcp", "Document protected-resource and authorization discovery when authentication is required."),
  check("agent.mcp.safety", "mcp_readiness", 1, "mcp", "Describe read-only, destructive, idempotent, and open-world behavior accurately."),

  check("agent.trust.https", "operational_trust", 2, "always", "Serve advertised interfaces and documentation over HTTPS."),
  check("agent.trust.contact", "operational_trust", 2, "always", "Publish provider identity, support contact, version, status, and change information."),
  check("agent.trust.terms_privacy", "operational_trust", 2, "always", "Document terms, privacy, acceptable use, and retention where applicable."),
  check("agent.trust.errors_limits", "operational_trust", 2, "always", "Document stable errors, retry guidance, timeouts, quotas, and rate limits."),
  check("agent.trust.claim_accuracy", "operational_trust", 2, "always", "State limitations and avoid unsupported compliance or compatibility claims."),

  check("agent.commerce.applicable", "agent_commerce", 1, "commerce", "Only advertise agent commerce when a real machine-payment or usage-billing interface exists."),
  check("agent.commerce.discovery", "agent_commerce", 2, "commerce", "Advertise canonical price, billing unit, network, asset, and paid resource."),
  check("agent.commerce.challenge", "agent_commerce", 3, "commerce", "Return a valid unpaid challenge without requiring a signature or transferring funds during discovery."),
  check("agent.commerce.idempotency", "agent_commerce", 2, "commerce", "Document retry, idempotency, and duplicate-payment behavior."),
  check("agent.commerce.errors", "agent_commerce", 2, "commerce", "Document settlement timing, failure behavior, receipts, and support escalation."),
]);

function check(id, category, weight, appliesWhen, remediation) {
  return Object.freeze({ id, category, weight, appliesWhen, support: ["quick", "deep"], remediation });
}

export const AGENT_READINESS_RESULT_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://api.santosautomation.com/schemas/agent-readiness-result-1.0.0.json",
  title: "AgentReadinessResult",
  type: "object",
  required: [
    "schema_version", "target", "profile", "readiness_level", "score", "grade",
    "confidence", "tested_coverage_percent", "applicability", "subscores",
    "interfaces", "findings", "recommended_actions", "limitations",
  ],
  properties: {
    schema_version: { type: "string", const: AGENT_READINESS_SCHEMA_VERSION },
    target: {
      type: "object",
      required: ["requested_url", "canonical_origin", "final_url"],
      properties: {
        requested_url: { type: "string" },
        canonical_origin: { type: "string", format: "uri" },
        final_url: { type: "string", format: "uri" },
      },
      additionalProperties: false,
    },
    profile: {
      type: "string",
      enum: ["general_website", "documentation_site", "api_provider", "mcp_provider", "agent_commerce_provider"],
    },
    readiness_level: {
      type: "object",
      required: ["level", "name"],
      properties: { level: { type: "integer", minimum: 0, maximum: 4 }, name: { type: "string" } },
      additionalProperties: false,
    },
    score: { type: "integer", minimum: 0, maximum: 100 },
    grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    tested_coverage_percent: { type: "integer", minimum: 0, maximum: 100 },
    applicability: { type: "object", additionalProperties: { type: "string", enum: ["tested", "not_applicable", "unknown"] } },
    subscores: { type: "object", additionalProperties: { type: "integer", minimum: 0, maximum: 100 } },
    interfaces: { type: "object" },
    findings: { type: "array", items: { $ref: "#/$defs/finding" } },
    recommended_actions: { type: "array", items: { type: "object" } },
    limitations: { type: "array", items: { type: "string" } },
    fetch_budget: { type: "object" },
  },
  $defs: {
    finding: {
      type: "object",
      required: ["id", "category", "severity", "confidence", "status", "title", "recommendation"],
      properties: {
        id: { type: "string" },
        category: { type: "string" },
        severity: { type: "string", enum: ["info", "low", "moderate", "high"] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        status: { type: "string", enum: ["pass", "fail", "unknown", "not_applicable"] },
        title: { type: "string" },
        evidence: { type: "object" },
        recommendation: { type: "string" },
      },
    },
  },
});
