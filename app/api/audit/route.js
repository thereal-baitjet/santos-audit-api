import { after } from "next/server";
import { NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { facilitator } from "@coinbase/x402";
import { auditSite } from "../../../audit.js";
import { notifyTransaction } from "../../../notify.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";

// Receiving wallet (public address, not a secret) — hard-coded for mainnet.
// (No env fallback: stale project env vars must not silently flip us back to testnet.)
const SELLER = "0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B";
const NETWORK = "base";

async function handler(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  try {
    const report = await auditSite(url);
    return NextResponse.json({ tier: "paid", ...report }, { headers: CORS });
  } catch (e) {
    // withX402 only settles payment for responses under 400, so a failed
    // audit here costs the agent nothing.
    return auditErrorResponse(e);
  }
}

const paidHandler = withX402(
  handler,
  SELLER,
  {
    price: "$0.005",
    network: NETWORK,
    config: {
      description:
        "Audit a public website for performance, SEO, accessibility, and security. Returns category scores (0-100), detailed checks, detected issues, and plain-English remediation guidance.",
      // Bazaar discovery metadata — indexed by x402-aware catalogs from the 402 response.
      discoverable: true,
      inputSchema: {
        queryParams: {
          url: "Required. The public HTTP or HTTPS website URL to audit, e.g. https://example.com",
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          tier: { type: "string" },
          url: { type: "string" },
          fetched_at: { type: "string", format: "date-time" },
          http_status: { type: "integer" },
          timing_ms: {
            type: "object",
            properties: { ttfb: { type: "integer" }, total: { type: "integer" } },
          },
          overall_score: { type: "integer", minimum: 0, maximum: 100 },
          scores: {
            type: "object",
            properties: {
              performance: { type: "integer" },
              seo: { type: "integer" },
              accessibility: { type: "integer" },
              security: { type: "integer" },
            },
          },
          checks: { type: "object" },
          issues: { type: "array", items: { type: "string" } },
          audited_by: { type: "string" },
        },
      },
    },
  },
  facilitator
);

export async function GET(req) {
  const res = await paidHandler(req);
  const receipt = res.headers.get("X-PAYMENT-RESPONSE");
  if (receipt) {
    const { transaction, network, payer } = JSON.parse(
      Buffer.from(receipt, "base64").toString("utf-8")
    );
    after(() =>
      notifyTransaction({
        url: req.nextUrl.searchParams.get("url") ?? "",
        payer,
        transaction,
        network,
        amount: "0.005",
      })
    );
  }
  return res;
}
