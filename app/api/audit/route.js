import { NextResponse } from "next/server";
import { withX402 } from "x402-next";
import { facilitator } from "@coinbase/x402";
import { auditSite } from "../../../audit.js";

// Receiving wallet (public address, not a secret) — hard-coded for mainnet.
// (No env fallback: stale project env vars must not silently flip us back to testnet.)
const SELLER = "0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B";
const NETWORK = "base";

async function handler(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  try {
    const report = await auditSite(url);
    return NextResponse.json({ tier: "paid", ...report }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    // withX402 only settles payment for responses under 400, so a bad
    // URL here costs the agent nothing.
    return NextResponse.json(
      { error: `Could not audit: ${e.message}` },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export const GET = withX402(
  handler,
  SELLER,
  {
    price: "$0.005",
    network: NETWORK,
    config: { description: "Full site audit: performance, SEO, accessibility, security" },
  },
  facilitator
);
