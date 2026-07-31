// RETIRED free endpoint. Answers 402 pointing at the paid Structured Extraction.
//
// This is the route that was stuck returning 503 SERVICE_DEGRADED after the
// 2026-07-30 pooler incident: the limiter latched into degraded mode and the
// heavy free path stayed refused. It is paid-only now, so the gate is gone.
import { NextResponse } from "next/server";
import { withAgentLog } from "../../../../../lib/agent-log.js";
import { CORS } from "../../../../../lib/errors.js";
import { retiredFreeTier } from "../../../../../lib/retired-free-tier.js";

const handlePOST = (req) => retiredFreeTier(req, "/v1/extract/structured");

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withAgentLog(handlePOST, "structured-extract-demo-retired");
