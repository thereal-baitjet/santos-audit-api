// GET /api/audit success contract. OpenAPI 200 and the Bazaar output schema
// share this object so the paid route cannot advertise two output contracts.
import { AGENT_READINESS_RESULT_SCHEMA } from "./agent-readiness/contract.js";

const scoreSchema = { type: "integer", minimum: 0, maximum: 100 };

export const websiteIntelligenceSchema = {
  type: "object",
  description: "Additive presentation-layer synthesis. Historical score fields retain their established semantics.",
  required: ["schema_version", "score", "dimensions", "applicability", "coverage", "scoring_note"],
  properties: {
    schema_version: { type: "string", const: "1.0.0" },
    score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    dimensions: {
      type: "object",
      required: ["discoverable", "understandable", "callable", "trustworthy"],
      properties: {
        discoverable: { type: ["integer", "null"], minimum: 0, maximum: 100 },
        understandable: { type: ["integer", "null"], minimum: 0, maximum: 100 },
        callable: { type: ["integer", "null"], minimum: 0, maximum: 100 },
        trustworthy: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      },
    },
    applicability: { type: "object", properties: { callable: { type: "string", enum: ["tested", "not_applicable"] } } },
    coverage: {
      type: "object",
      properties: {
        tests_available: { type: "integer", minimum: 0 },
        tests_executed: { type: "integer", minimum: 0 },
        tests_not_applicable: { type: "integer", minimum: 0 },
        tests_skipped: { type: "integer", minimum: 0 },
        tested_percent: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    priority_fixes: { type: "array", items: { type: "object" } },
    scoring_note: { type: "string" },
  },
};

export const AUDIT_REPORT_REQUIRED = [
  "tier",
  "url",
  "fetched_at",
  "http_status",
  "timing_ms",
  "overall_score",
  "scores",
  "checks",
  "issues",
];

// Optional website_intelligence and agent_readiness are the same objects
// published under components.schemas. Embedding them keeps JSON Schema
// semantics while remaining evaluable without local $ref.
export const auditReportSchema = {
  type: "object",
  required: [...AUDIT_REPORT_REQUIRED],
  properties: {
    schema_version: { type: "string", enum: ["2.1.0"] },
    tier: { type: "string", enum: ["paid"] },
    url: { type: "string", format: "uri", description: "The final URL audited, after redirects." },
    fetched_at: { type: "string", format: "date-time" },
    http_status: { type: "integer", description: "HTTP status returned by the audited site." },
    timing_ms: {
      type: "object",
      properties: { ttfb: { type: "integer" }, total: { type: "integer" } },
      description: "Time-to-first-byte and total fetch time in milliseconds.",
    },
    overall_score: scoreSchema,
    website_intelligence_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    website_intelligence: websiteIntelligenceSchema,
    scores: {
      type: "object",
      required: ["performance", "seo", "accessibility", "security"],
      properties: {
        performance: scoreSchema,
        seo: scoreSchema,
        accessibility: scoreSchema,
        security: scoreSchema,
      },
    },
    checks: {
      type: "object",
      description: "Per-category check results. Each entry has pass, detail, and (on failure) fix.",
      additionalProperties: {
        type: "array",
        items: {
          type: "object",
          required: ["pass", "detail"],
          properties: {
            pass: { type: "boolean" },
            detail: { type: "string" },
            fix: { type: "string" },
          },
        },
      },
    },
    issues: {
      type: "array",
      items: { type: "string" },
      description: "Plain-English remediation instructions for every failed check.",
    },
    agent_readiness: AGENT_READINESS_RESULT_SCHEMA,
    audited_by: { type: "string" },
  },
};

// Same required fields the handler always returns. Optional additive fields
// are omitted; they are not guaranteed.
export const auditReportExample = {
  tier: "paid",
  url: "https://example.com/",
  fetched_at: "2026-01-01T00:00:00.000Z",
  http_status: 200,
  timing_ms: { ttfb: 42, total: 180 },
  overall_score: 68,
  scores: { performance: 100, seo: 40, accessibility: 100, security: 33 },
  checks: {
    seo: [{ pass: false, detail: "Missing canonical link", fix: "Missing canonical link" }],
    security: [{ pass: false, detail: "Missing Content-Security-Policy header", fix: "Missing Content-Security-Policy header" }],
  },
  issues: ["Missing canonical link", "Missing Content-Security-Policy header"],
};
