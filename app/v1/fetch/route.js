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

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Fetch one public URL through a hardened safe-fetcher and get the raw text body plus response metadata (final URL after redirects, status, selected headers, byte count, timing). SSRF-guarded — private, link-local, and cloud-metadata addresses are blocked including via redirects — with a 15s timeout, 2MB cap, and ports 80/443 only. Text formats only (HTML, JSON, XML, feeds, plain text, JS, SVG); read-only, no crawling, no JavaScript rendering.",
  mimeType: "application/json",
  serviceName: "Santos Safe Fetch",
  tags: ["web-fetch", "http-client", "ssrf-safe", "scraping", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful fetch. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { url: "https://example.com/data.json" },
      inputSchema: {
        properties: { url: { type: "string", description: "Public HTTP or HTTPS URL to fetch (text formats only)." } },
        required: ["url"],
      },
      output: {
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
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/fetch": routeConfig,
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

export async function GET(req) {
  return paidWithReceipt(req);
}

export async function POST(req) {
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
