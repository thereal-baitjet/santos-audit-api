import { NextResponse } from "next/server";
import { auditSite } from "../../../../audit.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../../../lib/demo-limit.js";

export async function GET(req) {
  const ip = ipFromRequest(req);
  const url = req.nextUrl.searchParams.get("url") ?? "";

  // Reject invalid/blocked targets before touching the rate limit.
  try {
    validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  if (!hasFreeAudit(ip)) {
    return NextResponse.json(
      { error: "Free demo is 1 audit/day. Agents can pay per-call at GET /api/audit (x402, $0.005).", code: "RATE_LIMITED" },
      { status: 429, headers: CORS }
    );
  }

  try {
    const report = await auditSite(url);
    markFreeAudit(ip);
    return NextResponse.json({ tier: "free-demo", ...report }, { headers: CORS });
  } catch (e) {
    return auditErrorResponse(e);
  }
}
