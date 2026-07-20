import { withAgentLog } from "../../../lib/agent-log.js";
// POST /v1/extract (also GET ?url=) — page-to-Markdown extraction, x402-paid.
// Payment settles only on a successful response; failed extractions are free.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { extractPage, EXTRACT_SCHEMA_VERSION } from "../../../lib/extract.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = process.env.EXTRACT_PRICE_USDC ?? "0.005";

async function targetFrom(req) {
  if (req.method === "GET") return req.nextUrl.searchParams.get("url") ?? "";
  const body = await req.json().catch(() => ({}));
  return typeof body.url === "string" ? body.url : "";
}

async function handler(req) {
  try {
    const url = await targetFrom(req);
    // Validation runs AFTER the paywall so unpaid discovery probes get the 402
    // challenge; a paid-but-invalid request 400s here and never settles.
    validateTarget(url);
    const result = await extractPage(url);
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Extract one public web page as clean Markdown: main content isolated readability-style, plus title, description, canonical URL, outbound links, and word count. Read-only single-page fetch — no crawling, no JavaScript rendering.",
  mimeType: "application/json",
  serviceName: "Santos Page-to-Markdown Extractor",
  tags: ["content-extraction", "markdown", "web-scraping", "rag", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful extraction. Free demo: GET /v1/extract/demo?url=… (1/day per IP). Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { url: "https://example.com/article" },
      inputSchema: {
        properties: { url: { type: "string", description: "Public HTTP or HTTPS page to extract." } },
        required: ["url"],
      },
      output: {
        example: {
          schema_version: EXTRACT_SCHEMA_VERSION,
          url: "https://example.com/article",
          final_url: "https://example.com/article",
          http_status: 200,
          title: "Example article",
          markdown: "# Example article\n\nBody text…",
          links: [{ url: "https://example.com/next", text: "Next page" }],
          word_count: 245,
        },
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/extract": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

async function paidWithReceipt(req) {
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
          url: "page-to-markdown extraction",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode extract settlement receipt:", e.message);
    }
  }
  return res;
}

async function handlePOST(req) {
  return paidWithReceipt(req);
}

async function handleGET(req) {
  return paidWithReceipt(req);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const GET = withAgentLog(handleGET, "extract");
export const POST = withAgentLog(handlePOST, "extract");
