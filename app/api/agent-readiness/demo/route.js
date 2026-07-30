// RETIRED free endpoint. Answers 402 pointing at the paid Agent Readiness audit.
import { NextResponse } from "next/server";
import { withAgentLog } from "../../../../lib/agent-log.js";
import { CORS } from "../../../../lib/errors.js";
import { retiredFreeTier } from "../../../../lib/retired-free-tier.js";

const handleGET = (req) => retiredFreeTier(req, "/api/agent-readiness");

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

export const GET = withAgentLog(handleGET, "agent-readiness-demo-retired");
