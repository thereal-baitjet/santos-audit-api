// RETIRED free endpoint. Answers 402 pointing at the paid Safe Fetch.
import { NextResponse } from "next/server";
import { withAgentLog } from "../../../../lib/agent-log.js";
import { CORS } from "../../../../lib/errors.js";
import { retiredFreeTier } from "../../../../lib/retired-free-tier.js";

const handleGET = (req) => retiredFreeTier(req, "/v1/fetch");

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

export const GET = withAgentLog(handleGET, "safe-fetch-demo-retired");
