import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/fetch?url= (also POST {"url"}) — Safe Fetch, x402-paid.
// The hardened safe-fetcher sold directly: raw text body + response metadata.
// Payment settles only on a successful fetch; failures are free.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { fetchUrl, SAFE_FETCH_SCHEMA_VERSION } from "../../../lib/fetch-product.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { bazaarResourceMeta } from "../../../lib/bazaar-catalog.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = process.env.SAFE_FETCH_PRICE_USDC ?? "0.002";

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
    const result = await fetchUrl(url);
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const INPUT_SCHEMA = {
  properties: { url: { type: "string", description: "Public HTTP or HTTPS URL to fetch (text formats only)." } },
  required: ["url"],
};
const INPUT_EXAMPLE = { url: "https://example.com/data.json" };
const OUTPUT = {
  example: {
    schema_version: SAFE_FETCH_SCHEMA_VERSION,
    url: "https://example.com/data.json",
    final_url: "https://example.com/data.json",
    http_status: 200,
    content_type: "application/json",
    headers: { "content-type": "application/json" },
    body: "{\"hello\":\"world\"}",
    body_bytes: 17,
  },
};

// Fresh config per verb: the Bazaar extension rewrites info.input.method from
// the live request, so a GET must advertise query params and a POST a JSON
// body. Both pin the same canonical resource URL, so they remain one catalog
// resource rather than two.
const buildConfig = (discovery) => ({
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Fetch one public URL through a hardened safe-fetcher and get the raw text body plus response metadata (final URL after redirects, status, selected headers, byte count, timing). SSRF-guarded — private, link-local, and cloud-metadata addresses are blocked including via redirects — with a 15s timeout, 2MB cap, and ports 80/443 only. Text formats only (HTML, JSON, XML, feeds, plain text, JS, SVG); read-only, no crawling, no JavaScript rendering.",
  mimeType: "application/json",
  ...bazaarResourceMeta("safe-fetch"),
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful fetch. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: { ...declareDiscoveryExtension(discovery) },
});

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const getServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/fetch": buildConfig({ input: INPUT_EXAMPLE, inputSchema: INPUT_SCHEMA, output: OUTPUT }),
});
const postServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/fetch": buildConfig({
    bodyType: "json",
    input: INPUT_EXAMPLE,
    inputSchema: INPUT_SCHEMA,
    output: OUTPUT,
  }),
});
const paidGET = withX402FromHTTPServer(handler, getServer);
const paidPOST = withX402FromHTTPServer(handler, postServer);

async function paidWithReceipt(req, paidHandler) {
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
          url: "safe fetch",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode safe-fetch settlement receipt:", e.message);
    }
  }
  return res;
}

async function handleGET(req) {
  return paidWithReceipt(req, paidGET);
}

async function handlePOST(req) {
  return paidWithReceipt(req, paidPOST);
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

export const GET = withAgentLog(handleGET, "safe-fetch");
export const POST = withAgentLog(handlePOST, "safe-fetch");
