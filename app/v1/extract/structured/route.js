import { withAgentLog } from "../../../../lib/agent-log.js";
// POST /v1/extract/structured — page-to-JSON extraction against a caller-supplied
// JSON Schema, x402-paid. Payment settles only when the extracted data validates
// against that schema; a page that can't satisfy it, or a bad schema, costs nothing.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { extractStructured, STRUCTURED_EXTRACTION_SCHEMA_VERSION, MODEL } from "../../../../lib/extract-structured.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../../lib/x402-server.js";
import { notifyTransaction } from "../../../../notify.js";

export const maxDuration = 30;

// Worst case: ~4000 input tokens (8000-char content cap + system prompt + up to
// 4000-char caller schema in the tool definition) + 1024 output tokens, at
// Sonnet 5 standard pricing $3/$15 per MTok => ~$0.027 worst-case upstream cost;
// priced at $0.08 for roughly 3x margin (first metered-LLM-cost product in the suite).
const PRICE = process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08";

async function handler(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url : "";
    // Validation runs AFTER the paywall so unpaid discovery probes still get
    // the 402 challenge; a paid-but-invalid request 400s here and never settles.
    validateTarget(url);
    const result = await extractStructured(url, body.schema);
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Extract structured JSON from one public web page against a caller-supplied JSON Schema. Fetches and cleans the page (SSRF-guarded, readability-isolated Markdown, truncated to 8000 characters), then calls Claude with forced tool-use to populate exactly the fields the schema asks for — never fabricating values not present on the page. The extracted data is validated against the caller's own schema before it is returned.",
  mimeType: "application/json",
  serviceName: "Santos Structured Extraction",
  tags: ["structured-extraction", "json-schema", "llm", "content-extraction", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode PAYMENT-REQUIRED for the $${PRICE} USDC terms, sign, and retry with PAYMENT-SIGNATURE. Payment settles only when the extracted data validates against your schema; a schema that can't be satisfied from the page costs nothing.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: {
        url: "https://example.com/product/123",
        schema: {
          type: "object",
          properties: { price: { type: "number" }, in_stock: { type: "boolean" } },
          required: ["price", "in_stock"],
        },
      },
      inputSchema: {
        properties: {
          url: { type: "string", description: "Public HTTP or HTTPS page to extract structured data from." },
          schema: { type: "object", description: "A caller-supplied JSON Schema (type: object, self-contained, no $ref) describing the fields to extract." },
        },
        required: ["url", "schema"],
      },
      output: {
        example: {
          schema_version: STRUCTURED_EXTRACTION_SCHEMA_VERSION,
          url: "https://example.com/product/123",
          final_url: "https://example.com/product/123",
          http_status: 200,
          data: { price: 49.99, in_stock: true },
          model: MODEL,
          fetched_at: "2026-01-01T00:00:00.000Z",
          timing_ms: { fetch: 120, llm: 1800, total: 1950 },
        },
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall (a
// "POST /path" key would only match POST and let HEAD probes run unpaid).
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/extract/structured": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

async function handlePOST(req) {
  const res = await paidHandler(req);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.headers.set("Cache-Control", "no-store");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() =>
        notifyTransaction({
          url: "structured data extraction",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode structured-extraction settlement receipt:", e.message);
    }
  }
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withAgentLog(handlePOST, "structured-extract");
