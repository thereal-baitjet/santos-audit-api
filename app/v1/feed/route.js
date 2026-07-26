import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/feed?url= (also POST {"url"}) — Feed Parser, x402-paid.
// RSS 2.0, Atom, and JSON Feed in → one normalized feed object out.
// Payment settles only on a successful parse; failures are free.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { parseFeed, FEED_SCHEMA_VERSION } from "../../../lib/feed.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = process.env.FEED_PRICE_USDC ?? "0.003";

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
    const result = await parseFeed(url);
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Parse any RSS 2.0, Atom, or JSON Feed URL into one normalized JSON object: feed metadata (title, link, description, feed URL) plus up to 50 items with id, title, url, published date, summary (500 chars max), and author. Fetched through an SSRF-guarded safe-fetcher — private, link-local, and cloud-metadata addresses are blocked — with a 15s timeout and 2MB cap. Payment settles only on a successful parse.",
  mimeType: "application/json",
  serviceName: "Santos Feed Parser",
  tags: ["feed", "rss", "atom", "json-feed", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful parse. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { url: "https://example.com/feed.xml" },
      inputSchema: {
        properties: { url: { type: "string", description: "Public HTTP or HTTPS URL of an RSS 2.0, Atom, or JSON feed." } },
        required: ["url"],
      },
      output: {
        example: {
          schema_version: FEED_SCHEMA_VERSION,
          url: "https://example.com/feed.xml",
          final_url: "https://example.com/feed.xml",
          format: "rss2",
          feed: {
            title: "Example Blog",
            link: "https://example.com",
            description: "All the examples",
            feed_url: "https://example.com/feed.xml",
          },
          item_count: 1,
          items: [
            {
              id: "https://example.com/posts/1",
              title: "Hello World",
              url: "https://example.com/posts/1",
              published: "Mon, 01 Jan 2024 00:00:00 GMT",
              summary: "The first post.",
              author: "Alice",
            },
          ],
        },
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/feed": routeConfig,
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
          url: "feed parser",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode feed-parser settlement receipt:", e.message);
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

export const GET = withAgentLog(handleGET, "feed");
export const POST = withAgentLog(handlePOST, "feed");
