import { NextResponse } from "next/server";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";
import { AGENT_READINESS_RESULT_SCHEMA } from "../../lib/agent-readiness/contract.js";
import { getAgentReadinessPriceUsdc, usdcAtomicAmount } from "../../lib/agent-readiness/product-pricing.js";

const AGENT_READINESS_PRICE = getAgentReadinessPriceUsdc();
const AGENT_READINESS_ATOMIC_PRICE = usdcAtomicAmount(AGENT_READINESS_PRICE);

const scoreSchema = { type: "integer", minimum: 0, maximum: 100 };

const websiteIntelligenceSchema = {
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

const auditReportSchema = {
  type: "object",
  required: ["tier", "url", "fetched_at", "http_status", "timing_ms", "overall_score", "scores", "checks", "issues"],
  properties: {
    schema_version: { type: "string", enum: ["2.1.0"] },
    tier: { type: "string", enum: ["paid", "free-demo"] },
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
    website_intelligence: { $ref: "#/components/schemas/WebsiteIntelligence" },
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
    agent_readiness: { $ref: "#/components/schemas/AgentReadinessResult" },
    audited_by: { type: "string" },
  },
};

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string", description: "Human-readable explanation." },
    code: {
      type: "string",
      description: "Stable machine-readable error code.",
      enum: [
        "INVALID_URL", "UNSUPPORTED_SCHEME", "PRIVATE_ADDRESS_BLOCKED",
        "RATE_LIMITED", "AUDIT_TIMEOUT", "TARGET_UNREACHABLE", "AUDIT_FAILED",
      ],
    },
  },
};

const urlParam = {
  name: "url",
  in: "query",
  required: true,
  schema: { type: "string", format: "uri" },
  description:
    "Publicly reachable HTTP or HTTPS website URL. Bare domains are accepted (https:// is assumed). Localhost, private-network, and cloud-metadata addresses are rejected.",
  example: "https://example.com",
};

const deepJobSchema = {
  type: "object",
  properties: {
    job_id: { type: "string", description: "Unguessable job id (aud_...)." },
    status: { type: "string", enum: ["queued", "running", "aggregating", "completed", "failed", "expired", "cancelled"] },
    stage: { type: ["string", "null"] },
    progress: { type: "integer", minimum: 0, maximum: 100 },
    access_token: { type: "string", description: "Returned ONCE at creation; required (Bearer or ?token=) for every status/report/events/cancel call. Job ids alone are never authorization." },
    status_url: { type: "string", format: "uri" },
    report_url: { type: "string", format: "uri" },
    events_url: { type: "string", format: "uri" },
    artifacts_url: { type: "string", format: "uri" },
    payment_contract: { type: "string" },
    error_code: { type: "string" },
    error_message: { type: "string" },
  },
};

const document = {
  openapi: "3.1.0",
  info: {
    title: "Santos Website Intelligence API",
    version: "2.3.1",
    description:
      `AI Website Intelligence for determining whether public websites can be discovered, understood, trusted, and used by agents. Three paid capabilities use USDC on Base mainnet (eip155:8453) via x402 v2 with no account or traditional API key. QUICK INTELLIGENCE (GET /api/audit, $0.015, synchronous): lightweight single-page fetch-and-parse audit. AGENT READINESS (GET /api/agent-readiness, $${AGENT_READINESS_PRICE}, synchronous): bounded passive discovery and applicability-aware assessment of agent-facing interfaces. DEEP WEBSITE INTELLIGENCE (POST /v1/audits, $0.225, asynchronous): real Chromium via Playwright, Lighthouse, rendered axe-core, browser evidence, screenshots, and passive security checks. Quick and Agent Readiness payments settle only on a successful response; Deep payment purchases a bounded compute reservation and settles when the job is accepted.`,
    contact: { name: "Santos Automation", email: "info@santosautomation.com", url: "https://www.santosautomation.com" },
  },
  servers: [{ url: PUBLIC_API_BASE_URL }],
  paths: {
    "/api/agent-readiness": {
      get: {
        operationId: "auditAgentReadiness",
        tags: ["Agent Readiness"],
        summary: `Assess public agent-facing interfaces ($${AGENT_READINESS_PRICE} USDC via x402)`,
        description: `Requires $${AGENT_READINESS_PRICE} USDC through x402 v2 and settles only after a successful audit response. Classifies the target before scoring and evaluates only applicable surfaces: discovery/docs, structured identity, APIs, MCP, operational trust, and machine commerce. For paid surfaces it normalizes public pricing claims and compares only claims scoped to the same paid resource against an unsigned x402 challenge. The quick pass performs at most eight additional bounded public requests. It never authenticates, creates accounts, submits forms, signs target payments, transfers funds to the target, or invokes advertised MCP/business tools. llms.txt is treated as a proposal and the MCP Registry as preview infrastructure.`,
        parameters: [urlParam, { name: "depth", in: "query", required: false, schema: { type: "string", enum: ["quick"], default: "quick" } }],
        responses: {
          200: { description: "Versioned Agent Readiness result with additive Website Intelligence presentation fields.", content: { "application/json": { schema: { $ref: "#/components/schemas/AgentReadinessResult" } } } },
          400: { description: "Invalid or blocked target URL.", content: { "application/json": { schema: errorSchema } } },
          402: { description: `Payment required. PAYMENT-REQUIRED contains x402 v2 terms for $${AGENT_READINESS_PRICE} USDC (${AGENT_READINESS_ATOMIC_PRICE} atomic units) on eip155:8453.` },
          502: { description: "Target or required public interface was unreachable.", content: { "application/json": { schema: errorSchema } } },
          504: { description: "Bounded audit timed out.", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/api/audit": {
      get: {
        operationId: "auditWebsite",
        tags: ["Quick Intelligence"],
        summary: "Run a Quick Intelligence Audit ($0.015 USDC via x402)",
        description:
          "Requires x402 v2 payment. An unpaid request returns HTTP 402 with machine-readable terms in the base64 `PAYMENT-REQUIRED` response header (`accepts[0]`: $0.015 USDC as amount \"15000\", network eip155:8453, scheme `exact`), including an x402 Bazaar discovery extension with input/output JSON Schemas. Sign an EIP-3009 transferWithAuthorization for the quoted amount and retry with the `PAYMENT-SIGNATURE` request header. Any x402 v2 client (e.g. @x402/fetch) automates this. Payment settles only after a successful (2xx) response — failed audits cost nothing. Rejected payments and audit failures return structured errors.",
        parameters: [urlParam],
        responses: {
          200: {
            description: "Audit complete; payment settled. The PAYMENT-RESPONSE header carries a base64 on-chain receipt (transaction hash, network, payer).",
            headers: {
              "PAYMENT-RESPONSE": {
                schema: { type: "string" },
                description: "Base64-encoded JSON settlement receipt: { success, transaction, network, payer }.",
              },
            },
            content: { "application/json": { schema: auditReportSchema } },
          },
          402: {
            description: "Payment required, invalid, or failed verification. Full terms are in the base64 PAYMENT-REQUIRED response header (x402Version 2, accepts[], extensions.bazaar); the JSON body is a short agent-readable hint.",
            headers: {
              "PAYMENT-REQUIRED": {
                schema: { type: "string" },
                description: "Base64-encoded JSON: { x402Version: 2, resource, accepts: [{ scheme, network, amount, asset, payTo, maxTimeoutSeconds }], extensions }. amount \"15000\" = $0.015 USDC.",
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    code: { type: "string", enum: ["PAYMENT_REQUIRED"] },
                    hint: { type: "string" },
                  },
                },
              },
            },
          },
          400: { description: "Invalid or blocked target URL.", content: { "application/json": { schema: errorSchema } } },
          502: { description: "Target site unreachable.", content: { "application/json": { schema: errorSchema } } },
          504: { description: "Target site timed out (15s limit).", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/api/audit/demo": {
      get: {
        operationId: "auditWebsiteDemo",
        security: [], // free endpoint — excluded from x402 registry probing
        tags: ["Quick Intelligence"],
        summary: "Free Quick Intelligence demo (1/day per IP)",
        description:
          "Identical report shape to the paid endpoint (tier is \"free-demo\"). Use it to inspect the result format before integrating payment. Rate-limited to 1 request per IP per day; 429 with code RATE_LIMITED after that.",
        parameters: [urlParam],
        responses: {
          200: { description: "Audit complete.", content: { "application/json": { schema: auditReportSchema } } },
          400: { description: "Invalid or blocked target URL.", content: { "application/json": { schema: errorSchema } } },
          429: { description: "Daily free limit reached.", content: { "application/json": { schema: errorSchema } } },
          502: { description: "Target site unreachable.", content: { "application/json": { schema: errorSchema } } },
          504: { description: "Target site timed out.", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/v1/audits": {
      post: {
        operationId: "createDeepAudit",
        tags: ["Deep Website Intelligence"],
        summary: "Create a Deep Website Intelligence job ($0.225 USDC via x402, asynchronous)",
        description:
          "Requires x402 v2 payment (base64 PAYMENT-REQUIRED challenge header; retry with PAYMENT-SIGNATURE). The payment purchases one bounded compute reservation — it settles when the job is ACCEPTED (201), not when the report completes. Runs a real Chromium browser (Playwright) against the page: Lighthouse (mobile lab metrics), rendered axe-core accessibility checks (WCAG 2.x A/AA tags), browser network/console evidence, screenshots, and passive security checks. Send an Idempotency-Key header so retries return the existing job (409 IDEMPOTENT_REPLAY, not charged) instead of purchasing a duplicate. Typical completion: tens of seconds to a few minutes; poll status_url.",
        parameters: [{
          name: "Idempotency-Key", in: "header", required: false, schema: { type: "string" },
          description: "Strongly recommended. Same key + same body returns the existing job without a second charge; same key + different body is rejected (422 IDEMPOTENCY_KEY_REUSED).",
        }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri", description: "Public HTTP/HTTPS page. Private-network/metadata targets rejected free of charge." },
                  devices: { type: "array", items: { type: "string", enum: ["mobile", "desktop"] }, default: ["mobile"] },
                  modules: { type: "array", items: { type: "string", enum: ["lighthouse", "accessibility", "browser-network", "security-passive", "agent-readiness", "ai-summary"] } },
                  artifacts: {
                    type: "object",
                    properties: {
                      screenshots: { type: "boolean", default: true },
                      lighthouse_json: { type: "boolean", default: true },
                      lighthouse_html: { type: "boolean", default: false },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Job accepted and queued; payment settles on this response. Save access_token — it is shown only once.", content: { "application/json": { schema: deepJobSchema } } },
          400: { description: "Invalid or blocked target/request (not charged).", content: { "application/json": { schema: errorSchema } } },
          402: { description: "Payment required/invalid. Terms in the PAYMENT-REQUIRED header; body is an agent-readable hint." },
          409: { description: "Idempotent replay: the existing job for this Idempotency-Key (not charged).", content: { "application/json": { schema: deepJobSchema } } },
          422: { description: "Idempotency-Key reused with a different body.", content: { "application/json": { schema: errorSchema } } },
          503: { description: "Deep tier not enabled or storage unavailable (not charged).", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/v1/audits/{job_id}": {
      get: {
        operationId: "getDeepAuditStatus",
        security: [], // token-authed job read, not x402-paid — excluded from registry probing
        tags: ["Deep Page Audit"],
        summary: "Job status (requires access token)",
        parameters: [
          { name: "job_id", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "query", required: false, schema: { type: "string" }, description: "Job access token (alternative to Authorization: Bearer)." },
        ],
        responses: {
          200: { description: "Job state.", content: { "application/json": { schema: deepJobSchema } } },
          401: { description: "Missing/invalid access token.", content: { "application/json": { schema: errorSchema } } },
          404: { description: "Unknown job.", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/v1/audits/{job_id}/report": {
      get: {
        operationId: "getDeepAuditReport",
        security: [], // token-authed job read, not x402-paid — excluded from registry probing
        tags: ["Deep Page Audit"],
        summary: "Completed report (versioned JSON, requires access token)",
        description:
          "schema_version 3.0.0. Sections: target, engines (Chromium/Lighthouse/axe versions), module_status, deterministic scores + scoring_method, lab metrics (labeled laboratory data), network metrics, normalized findings (stable id, engine, category, severity, confidence, status, evidence, standards, recommendation), optional ai_summary (model-generated narrative, clearly labeled), artifacts with short-lived signed download URLs, and explicit limitations.",
        parameters: [
          { name: "job_id", in: "path", required: true, schema: { type: "string" } },
          { name: "token", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "The report.", content: { "application/json": { schema: { type: "object", properties: { schema_version: { type: "string", const: "3.0.0" }, scores: { type: "object" }, website_intelligence_score: { type: ["integer", "null"] }, website_intelligence: { $ref: "#/components/schemas/WebsiteIntelligence" }, agent_readiness: { $ref: "#/components/schemas/AgentReadinessResult" }, findings: { type: "array", items: { type: "object" } } } } } } },
          401: { description: "Missing/invalid access token.", content: { "application/json": { schema: errorSchema } } },
          409: { description: "Job not completed yet (code REPORT_NOT_READY, includes status/stage/progress).", content: { "application/json": { schema: errorSchema } } },
          404: { description: "Unknown job or expired report.", content: { "application/json": { schema: errorSchema } } },
        },
      },
    },
    "/v1/audits/{job_id}/cancel": {
      post: {
        operationId: "cancelDeepAudit",
        security: [], // token-authed job action, not x402-paid — excluded from registry probing
        tags: ["Deep Page Audit"],
        summary: "Cancel a queued job (requires access token)",
        description: "Only queued jobs can be cancelled; running/terminal jobs return 409 NOT_CANCELLABLE. The compute reservation is spent either way.",
        parameters: [{ name: "job_id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Cancelled." },
          401: { description: "Missing/invalid access token." },
          409: { description: "Not cancellable." },
        },
      },
    },
  },
  components: { schemas: { AgentReadinessResult: AGENT_READINESS_RESULT_SCHEMA, WebsiteIntelligence: websiteIntelligenceSchema } },
  tags: [{ name: "Quick Intelligence" }, { name: "Agent Readiness" }, { name: "Deep Website Intelligence" }],
};

export async function GET() {
  return NextResponse.json(document, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
