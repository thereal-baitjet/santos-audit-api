import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/links?url= (also POST {"url"}) — Page Link Map, x402-paid.
// One HTML page in → categorized, deduped map of every hyperlink out.
// Payment settles only on a successful map; failures are free.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { mapLinks, LINKS_SCHEMA_VERSION } from "../../../lib/links.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = process.env.LINKS_PRICE_USDC ?? "0.003";

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
    const result = await mapLinks(url);
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Map every hyperlink on a public page: fetch one HTML URL (SSRF-guarded, 15s timeout, 2MB cap), resolve relative hrefs against the final URL, strip fragments, dedupe, and return up to 200 links with anchor text, internal/external kind, and topic tags (docs, pricing, api, careers, social, feed) plus per-category counts. Payment settles only on a successful map.",
  mimeType: "application/json",
  serviceName: "Santos Link Map",
  tags: ["links", "crawling", "site-map", "scraping", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful map. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { url: "https://example.com" },
      inputSchema: {
        properties: { url: { type: "string", description: "Public HTTP or HTTPS URL of an HTML page to map." } },
        required: ["url"],
      },
      output: {
        example: {
          schema_version: LINKS_SCHEMA_VERSION,
          url: "https://example.com",
          final_url: "https://example.com",
          http_status: 200,
          total_links: 2,
          counts: { internal: 1, external: 1, docs: 1, pricing: 0, api: 0, careers: 0, social: 1, feed: 0 },
          links: [
            { url: "https://example.com/docs", text: "Docs", kind: "internal", topics: ["docs"] },
            { url: "https://github.com/example", text: "GitHub", kind: "external", topics: ["social"] },
          ],
        },
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/links": routeConfig,
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
          url: "link map",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode link-map settlement receipt:", e.message);
    }
  }
  return res;
}

async function handleGET(req) {
  return paidWithReceipt(req);
}

async function handlePOST(req) {
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

export const GET = withAgentLog(handleGET, "links");
export const POST = withAgentLog(handlePOST, "links");
