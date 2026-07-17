import { NextResponse } from "next/server";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";

const scoreSchema = { type: "integer", minimum: 0, maximum: 100 };

const auditReportSchema = {
  type: "object",
  required: ["tier", "url", "fetched_at", "http_status", "timing_ms", "overall_score", "scores", "checks", "issues"],
  properties: {
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

const document = {
  openapi: "3.1.0",
  info: {
    title: "Santos Site Audit API",
    version: "1.0.0",
    description:
      "A machine-payable website auditing API for AI agents and automated workflows. Audits a public website for performance, SEO, accessibility, and security; returns category scores, detailed checks, detected issues, and plain-English remediation guidance. Production audits cost $0.005 USDC on Base mainnet (eip155:8453) via the x402 payment protocol — no account or API key required.",
    contact: { name: "Santos Automation", email: "baitjet@gmail.com", url: "https://santosautomation.com" },
  },
  servers: [{ url: PUBLIC_API_BASE_URL }],
  paths: {
    "/api/audit": {
      get: {
        operationId: "auditWebsite",
        tags: ["Website Audit"],
        summary: "Run a full site audit ($0.005 USDC via x402)",
        description:
          "Requires x402 v2 payment. An unpaid request returns HTTP 402 with machine-readable terms in the base64 `PAYMENT-REQUIRED` response header (`accepts[0]`: $0.005 USDC as amount \"5000\", network eip155:8453, scheme `exact`), including an x402 Bazaar discovery extension with input/output JSON Schemas. Sign an EIP-3009 transferWithAuthorization for the quoted amount and retry with the `PAYMENT-SIGNATURE` request header. Any x402 v2 client (e.g. @x402/fetch) automates this. Payment settles only after a successful (2xx) response — failed audits cost nothing. Rejected payments and audit failures return structured errors.",
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
                description: "Base64-encoded JSON: { x402Version: 2, resource, accepts: [{ scheme, network, amount, asset, payTo, maxTimeoutSeconds }], extensions }. amount \"5000\" = $0.005 USDC.",
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
        tags: ["Website Audit"],
        summary: "Free demo audit (1/day per IP)",
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
  },
  tags: [{ name: "Website Audit" }],
};

export async function GET() {
  return NextResponse.json(document, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
