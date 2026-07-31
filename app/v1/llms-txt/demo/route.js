// RETIRED free endpoint, and the one with NO paid successor: the llms.txt
// draft generator was never sold, and it was gated on the verified-email token
// that died with the free tier. It answers 410 rather than inventing a price
// for a product that does not exist.
//
// If llms.txt generation is worth selling, it becomes a normal entry in
// lib/products.js and this route turns into a retiredFreeTier() 402 like the
// rest.
import { NextResponse } from "next/server";
import { withAgentLog } from "../../../../lib/agent-log.js";
import { CORS } from "../../../../lib/errors.js";
import { retiredWithoutSuccessor } from "../../../../lib/retired-free-tier.js";

const handleGET = () => retiredWithoutSuccessor("The llms.txt draft generator");

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const GET = withAgentLog(handleGET, "llms-txt-demo-retired");
