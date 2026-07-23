// GET /v1/llms-txt/demo — free llms.txt draft generator, gated by the same
// verified-email token as /api/audit/free: 1 call/day per verified email,
// shared across the verified free tools (the audit widget and this generator
// draw from the same daily claim).
import { withAgentLog } from "../../../../lib/agent-log.js";
import { NextResponse } from "next/server";
import { generateLlmsTxt } from "../../../../lib/llms-txt.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { peekKey, claimKey, hashIdentity, secondsUntilUtcMidnight } from "../../../../lib/demo-limit.js";
import { verifyToken } from "../../../../lib/leads/verify.js";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Free tier is 1 call/day per verified email, shared across free tools.",
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

function notVerified() {
  return NextResponse.json(
    {
      error: "A verified email is required for the free llms.txt generator.",
      code: "EMAIL_NOT_VERIFIED",
      for_humans: "Verify once: POST /api/leads/verify/request {email, url} → 6-digit code by email → POST /api/leads/verify/confirm {email, code} → token valid 30 days.",
    },
    { status: 401, headers: CORS }
  );
}

// One claim per verified email per UTC day — same shared-quota key shape as
// /api/audit/free, so the audit and the generator share the daily free call.
function dailyEmailKey(email) {
  return `demo:${new Date().toISOString().slice(0, 10)}:email:${hashIdentity(email)}`;
}

async function handleGET(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";

  // Reject invalid/blocked targets before touching the rate limit.
  let target;
  try {
    target = validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  const email = await verifyToken(token);
  if (!email) return notVerified();

  const claimKeyForToday = dailyEmailKey(email);
  if (!(await peekKey(claimKeyForToday))) return rateLimited();

  try {
    const { llms_txt, notes } = await generateLlmsTxt(target.href);
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await claimKey(claimKeyForToday, secondsUntilUtcMidnight()))) return rateLimited();
    return NextResponse.json(
      { tier: "free-verified", url: target.href, llms_txt, notes },
      { headers: CORS }
    );
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

export const GET = withAgentLog(handleGET, "llms-txt-demo");
