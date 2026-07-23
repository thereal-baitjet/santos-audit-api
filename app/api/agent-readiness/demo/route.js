import { withAgentLog } from "../../../../lib/agent-log.js";
import { NextResponse } from "next/server";
import { auditAgentReadiness } from "../../../../lib/agent-readiness/analyze.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../../../lib/demo-limit.js";
import { getAgentReadinessPriceUsdc } from "../../../../lib/agent-readiness/product-pricing.js";
import { websiteIntelligenceSummary } from "../../../../lib/website-intelligence.js";
import { signReport } from "../../../../lib/report-signing.js";

const PRICE = getAgentReadinessPriceUsdc();

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: `Free demo is 1 audit/day (shared across all demo endpoints). Agents can pay per-call at GET /api/agent-readiness (x402, $${PRICE} USDC).`,
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
    const result = await auditAgentReadiness(url, { mode: "quick" });
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await markFreeAudit(ip))) return rateLimited();
    const websiteIntelligence = websiteIntelligenceSummary({ agentReadiness: result });
    return NextResponse.json(signReport({
      tier: "free-demo",
      website_intelligence_score: websiteIntelligence.score,
      website_intelligence: websiteIntelligence,
      ...result,
    }), { headers: CORS });
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

export const GET = withAgentLog(handleGET, "agent-readiness-demo");
