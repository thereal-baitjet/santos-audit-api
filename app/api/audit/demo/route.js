import { withAgentLog } from "../../../../lib/agent-log.js";
import { NextResponse } from "next/server";
import { auditSite } from "../../../../audit.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { openDemoQuota, FREE_TIER_HELP, INVALID_TOKEN_HELP } from "../../../../lib/demo-limit.js";
import { signReport } from "../../../../lib/report-signing.js";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Free demo is 1 audit/day (shared across all demo endpoints). Agents can pay per-call at GET /api/audit (x402, $0.015 USDC).",
      code: "RATE_LIMITED",
      for_humans: FREE_TIER_HELP,
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers: { ...CORS, "Retry-After": String(retryAfter) },
    }
  );
}

function invalidToken() {
  return NextResponse.json(
    { error: "That free-tier token is not valid or has expired.", code: "INVALID_TOKEN", for_humans: INVALID_TOKEN_HELP },
    { status: 401, headers: CORS }
  );
}

async function handleGET(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";

  // Reject invalid/blocked targets before touching the rate limit.
  try {
    validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  const gate = await openDemoQuota(req);
  if (!gate.ok) return gate.reason === "invalid_token" ? invalidToken() : rateLimited();

  try {
    const report = await auditSite(url);
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await gate.claim())) return rateLimited();
    return NextResponse.json(signReport({ tier: "free-demo", ...report }), { headers: CORS });
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
