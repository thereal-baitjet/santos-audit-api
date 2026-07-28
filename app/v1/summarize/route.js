import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/summarize?url=&focus= (also POST {"url","focus"}) — URL Summarizer, x402-paid.
// A Claude-written JSON brief of one public HTML page: title, ~200-word summary,
// key facts, named entities. Payment settles only on a successful summary —
// validation failures, non-HTML targets, and malformed model output are free.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { summarizeUrl, SUMMARIZE_SCHEMA_VERSION, MODEL } from "../../../lib/summarize.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { bazaarResourceMeta } from "../../../lib/bazaar-catalog.js";
import { notifyTransaction } from "../../../notify.js";

export const maxDuration = 30;

// 8000-char content cap (~2-2.5k input tokens) + ≤1024 output tokens at Sonnet 5
// standard pricing $3/$15 per MTok => ~$0.011 typical, ~$0.023 worst-case
// upstream cost; priced at $0.033 to stay profitable on worst-case calls.
const PRICE = process.env.SUMMARIZE_PRICE_USDC ?? "0.033";

async function inputFrom(req) {
  if (req.method === "GET") {
    return {
      url: req.nextUrl.searchParams.get("url") ?? "",
      focus: req.nextUrl.searchParams.get("focus") ?? undefined,
    };
  }
  const body = await req.json().catch(() => ({}));
  return {
    url: typeof body.url === "string" ? body.url : "",
    focus: typeof body.focus === "string" ? body.focus : undefined,
  };
}

async function handler(req) {
  try {
    const { url, focus } = await inputFrom(req);
    // Validation runs AFTER the paywall so unpaid discovery probes get the 402
    // challenge; a paid-but-invalid request 400s here and never settles.
    validateTarget(url);
    const result = await summarizeUrl({ url, focus });
    return NextResponse.json(result, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const buildConfig = (bodyType) => ({
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Summarize one public web page with Claude. Fetches the page (SSRF-guarded, readability-isolated Markdown, truncated to 8000 characters), then returns a tight JSON brief: title, ~200-word summary, up to 10 key facts, up to 15 named entities, and a word count. Pass an optional focus to prioritize information relevant to a specific topic. HTML pages only.",
  mimeType: "application/json",
  ...bazaarResourceMeta("summarize"),
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful summary. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      ...(bodyType ? { bodyType } : {}),
      input: { url: "https://example.com/blog/post", focus: "pricing" },
      inputSchema: {
        properties: {
          url: { type: "string", description: "Public HTTP or HTTPS page to summarize (HTML only)." },
          focus: { type: "string", description: "Optional topic to prioritize in the summary and key facts." },
        },
        required: ["url"],
      },
      output: {
        example: {
          schema_version: SUMMARIZE_SCHEMA_VERSION,
          url: "https://example.com/blog/post",
          final_url: "https://example.com/blog/post",
          http_status: 200,
          title: "Announcing Our New Pricing",
          summary: "The post announces a new usage-based pricing model...",
          key_facts: ["Starter tier is free up to 1,000 calls", "Pro tier costs $0.02 per call"],
          entities: ["Example Corp", "Base", "USDC"],
          word_count: 12,
          focus: "pricing",
          model: MODEL,
        },
      },
    }),
  },
});

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
// One server per verb: the Bazaar extension rewrites info.input.method from
// the live request, so GET must advertise query params and POST a JSON body.
const getServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/summarize": buildConfig(null),
});
const postServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/summarize": buildConfig("json"),
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
          url: "url summarizer",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode summarize settlement receipt:", e.message);
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

export const GET = withAgentLog(handleGET, "summarize");
export const POST = withAgentLog(handlePOST, "summarize");
