import { after, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { auditAgentReadiness } from "../../../lib/agent-readiness/analyze.js";
import { AGENT_READINESS_RESULT_SCHEMA } from "../../../lib/agent-readiness/contract.js";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { notifyTransaction } from "../../../notify.js";
import { getAgentReadinessPriceUsdc } from "../../../lib/agent-readiness/product-pricing.js";
import { websiteIntelligenceSummary } from "../../../lib/website-intelligence.js";

const PRICE = getAgentReadinessPriceUsdc();

async function handler(req) {
  try {
    const url = req.nextUrl.searchParams.get("url") ?? "";
    const depth = req.nextUrl.searchParams.get("depth") ?? "quick";
    if (depth !== "quick") return NextResponse.json({ error: "depth must be 'quick'", code: "INVALID_REQUEST" }, { status: 400, headers: CORS });
    const result = await auditAgentReadiness(url, { mode: "quick" });
    const websiteIntelligence = websiteIntelligenceSummary({ agentReadiness: result });
    return NextResponse.json({
      website_intelligence_score: websiteIntelligence.score,
      website_intelligence: websiteIntelligence,
      ...result,
    }, { headers: CORS });
  } catch (error) {
    return auditErrorResponse(error);
  }
}

const paidHandler = withX402(handler, {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description: "Run a bounded, passive Agent Readiness audit of public machine-facing interfaces. The auditor never authenticates to or pays the audited target, creates target accounts, submits forms, or invokes advertised business tools.",
  mimeType: "application/json",
  unpaidResponseBody: () => ({ contentType: "application/json", body: { error: "Payment required", code: "PAYMENT_REQUIRED", hint: `x402 v2: decode PAYMENT-REQUIRED for the $${PRICE} USDC terms, sign, and retry with PAYMENT-SIGNATURE. Payment settles only after a successful audit response.` } }),
  serviceName: "Santos Agent Readiness Audit",
  tags: ["agent-readiness", "openapi", "mcp", "llms-txt", "x402"],
  extensions: { ...declareDiscoveryExtension({
    input: { url: "https://example.com", depth: "quick" },
    inputSchema: { properties: { url: { type: "string", description: "Public HTTP or HTTPS target URL." }, depth: { type: "string", enum: ["quick"] } }, required: ["url"] },
    output: { schema: AGENT_READINESS_RESULT_SCHEMA },
  }) },
}, resourceServer);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE", "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE", "Access-Control-Max-Age": "86400" } });
}

export async function GET(req) {
  // Reject malformed/private targets before an optional payment challenge.
  try { validateTarget(req.nextUrl.searchParams.get("url") ?? ""); }
  catch (error) { return auditErrorResponse(error); }
  const response = await paidHandler(req);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  response.headers.set("Cache-Control", "no-store");
  const receipt = response.headers.get("PAYMENT-RESPONSE");
  if (receipt && response.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() => notifyTransaction({
        url: req.nextUrl.searchParams.get("url") ?? "",
        payer: settlement.payer,
        transaction: settlement.transaction,
        network: settlement.network,
        amount: PRICE,
      }));
    } catch (error) {
      console.error("Could not decode Agent Readiness settlement receipt:", error.message);
    }
  }
  return response;
}
