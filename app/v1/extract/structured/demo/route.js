import { withAgentLog } from "../../../../../lib/agent-log.js";
// POST /v1/extract/structured/demo — one free structured extraction per day per
// IP (quota shared with every other demo, so the free-tier surface stays one
// scan/call a day total). POST-only, matching the paid route: a JSON Schema
// doesn't fit cleanly URL-encoded into a query string the way a plain url= does,
// and there's no meaningful "discovery via GET" use case here either.
import { NextResponse } from "next/server";
import { extractStructured } from "../../../../../lib/extract-structured.js";
import { validateTarget } from "../../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../../lib/errors.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../../../../lib/demo-limit.js";

const PRICE = process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return NextResponse.json(
    { error: `Free demo is 1 request/day (shared with /api/audit/demo). Agents can pay per-call at POST /v1/extract/structured (x402, $${PRICE}).`, code: "RATE_LIMITED" },
    { status: 429, headers: { ...CORS, "Retry-After": String(Math.ceil((midnight - Date.now()) / 1000)) } }
  );
}

async function handlePOST(req) {
  const ip = ipFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url : "";

  try {
    validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  if (!(await hasFreeAudit(ip))) return rateLimited();

  try {
    const result = await extractStructured(url, body.schema);
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await markFreeAudit(ip))) return rateLimited();
    return NextResponse.json({ tier: "free-demo", ...result }, { headers: CORS });
  } catch (e) {
    return auditErrorResponse(e);
  }
}

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

export const POST = withAgentLog(handlePOST, "structured-extract-demo");
