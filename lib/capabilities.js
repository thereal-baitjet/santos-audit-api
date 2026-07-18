import { PUBLIC_API_BASE_URL } from "./base-url.js";

export function capabilityManifest() {
  const readinessPrice = process.env.AGENT_READINESS_PRICE_USDC?.trim();
  return {
    manifest_type: "santos-capability-manifest",
    manifest_version: "1.0.0",
    standard: false,
    description: "Vendor-specific discovery metadata; this is not an IETF, MCP, or schema.org standard.",
    provider: { name: "Santos Automation", url: "https://santosautomation.com" },
    capabilities: [
      {
        id: "site-audit.quick", title: "Quick Site Audit", version: "2.1.0", description: "Select for synchronous lightweight triage of one public page.",
        endpoint: `${PUBLIC_API_BASE_URL}/api/audit?url={url}`, method: "GET", mode: "synchronous",
        expected_latency: "seconds", input_schema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri" } } },
        output_schema: `${PUBLIC_API_BASE_URL}/openapi.json#/paths/~1api~1audit/get/responses/200`,
        access: "x402 v2 payment; no account or API key", billing_unit: "successful audit", idempotency: "safe GET; payment settles only on a successful response",
        side_effects: "read-only public fetch", rate_limits: "bounded target fetch", error_model: "stable JSON code and message", data_retention: "no target credentials or cookies collected",
        limitations: ["single page", "no JavaScript rendering", "not WCAG certification or a vulnerability scan"],
        documentation: `${PUBLIC_API_BASE_URL}/openapi.json`, support: "mailto:baitjet@gmail.com",
        price: { amount: "0.005", currency: "USDC", protocol: "x402-v2", network: "eip155:8453" },
      },
      {
        id: "agent-readiness.quick", title: "Agent Readiness Audit", version: "1.0.0", description: "Select to assess public agent-facing discovery, APIs, MCP, trust, and resource-scoped machine-commerce pricing without active target actions.",
        endpoint: `${PUBLIC_API_BASE_URL}/api/agent-readiness?url={url}`, method: "GET", mode: "synchronous",
        expected_latency: "seconds", input_schema: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri" }, depth: { type: "string", enum: ["quick"] } } },
        output_schema: `${PUBLIC_API_BASE_URL}/openapi.json#/components/schemas/AgentReadinessResult`,
        access: readinessPrice ? "x402 v2 payment; no account or API key" : "public, currently unpriced", billing_unit: readinessPrice ? "audit" : null,
        idempotency: "safe read-only GET", side_effects: "none on the target beyond bounded public reads", rate_limits: "maximum eight additional public requests",
        error_model: "stable JSON code and message", data_retention: "no authentication, payment signature, cookie, or secret collection",
        limitations: ["public surfaces only", "no authentication or payment", "no MCP tools/call", "llms.txt proposal and optional preview-registry evidence"],
        documentation: `${PUBLIC_API_BASE_URL}/openapi.json`, support: "mailto:baitjet@gmail.com",
        schema_version: "1.0.0", price: readinessPrice ? { amount: readinessPrice, currency: "USDC", protocol: "x402-v2", network: "eip155:8453" } : null,
      },
      {
        id: "site-audit.deep-page", title: "Deep Page Audit", version: "3.0.0", description: "Select for browser-rendered evidence and optional Agent Readiness discovery.",
        endpoint: `${PUBLIC_API_BASE_URL}/v1/audits`, method: "POST", mode: "asynchronous",
        expected_latency: "tens of seconds to minutes", input_schema: `${PUBLIC_API_BASE_URL}/openapi.json#/paths/~1v1~1audits/post/requestBody`, output_schema: `${PUBLIC_API_BASE_URL}/openapi.json#/paths/~1v1~1audits~1{job_id}~1report/get/responses/200`,
        access: "x402 v2 payment plus per-job bearer access token", billing_unit: "bounded compute reservation", idempotency: "Idempotency-Key supported",
        side_effects: "read-only public browser navigation", rate_limits: "bounded browser requests, bytes, runtime, and artifacts", error_model: "versioned job and report errors",
        data_retention: "short-lived report artifacts; target cookie values are never captured", limitations: ["single page", "lab data", "no authenticated flows or penetration testing"],
        documentation: `${PUBLIC_API_BASE_URL}/openapi.json`, support: "mailto:baitjet@gmail.com",
        price: { amount: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075", currency: "USDC", protocol: "x402-v2", network: "eip155:8453" },
      },
    ],
  };
}
