import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/fix-it?url= (also POST {"url"}) — "Fix-it-for-me" kit, x402-paid.
// One Agent Readiness audit in → executive summary, a publish-ready llms.txt,
// and a patched robots.txt out. Payment settles only on a successful kit.
//
// Dark until FIX_IT_ENABLED=true, same launch pattern as /v1/crawl: the price
// (FIX_IT_PRICE_USDC) isn't in lib/products.js, llms.txt, OpenAPI or the
// Bazaar catalog yet, so it must not be reachable or indexable before launch.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { buildFixKit } from "../../../lib/growth/fix-kit.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = process.env.FIX_IT_PRICE_USDC ?? "0.10";

function fixItGate() {
  if (process.env.FIX_IT_ENABLED === "true") return null;
  return NextResponse.json(
    { error: "The Fix-it kit is not enabled on this deployment yet. /api/agent-readiness remains available.", code: "SERVICE_UNAVAILABLE" },
    { status: 503, headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}

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
    return NextResponse.json(await buildFixKit(url), { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const config = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Fix-it kit for AI agent readiness: runs a passive Agent Readiness audit of one public site and returns an executive summary (Markdown and structured), a publish-ready llms.txt built from the live homepage and discovered machine interfaces, and a patched robots.txt that re-admits blocked AI crawlers while keeping private paths closed. Payment settles only on a successful kit.",
  mimeType: "application/json",
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only on a successful kit.`,
    },
  }),
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, { "/v1/fix-it": config });
const paid = withX402FromHTTPServer(handler, httpServer);

async function handle(req) {
  const gate = fixItGate();
  if (gate) return gate;
  const res = await paid(req);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.headers.set("Cache-Control", "no-store");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() =>
        notifyTransaction({
          url: "fix-it kit",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode fix-it settlement receipt:", e.message);
    }
  }
  return res;
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

export const GET = withAgentLog(handle, "fix-it");
export const POST = withAgentLog(handle, "fix-it");
