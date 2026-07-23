import { withAgentLog } from "../../../../lib/agent-log.js";
import { NextResponse } from "next/server";
import { auditSite } from "../../../../audit.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../../../lib/demo-limit.js";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Free demo is 1 audit/day (shared across all demo endpoints). Agents can pay per-call at GET /api/audit (x402, $0.015).",
      code: "RATE_LIMITED",
      for_humans: "No USDC wallet? Buy the one-time $5 Agent Readiness Report by card at /agent-readiness/buy — no account needed.",
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers: { ...CORS, "Retry-After": String(retryAfter) },
    }
  );
}

async function handleGET(req) {
  const ip = ipFromRequest(req);
  const url = req.nextUrl.searchParams.get("url") ?? "";

  // Reject invalid/blocked targets before touching the rate limit.
  try {
    validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  if (!(await hasFreeAudit(ip))) return rateLimited();

  try {
    const report = await auditSite(url);
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await markFreeAudit(ip))) return rateLimited();
    return NextResponse.json({ tier: "free-demo", ...report }, { headers: CORS });
  } catch (e) {
    return auditErrorResponse(e);
  }
}

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

export const GET = withAgentLog(handleGET, "quick-audit-demo");
