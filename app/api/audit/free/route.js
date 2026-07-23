// GET /api/audit/free — the browser widget's verified-email free audit:
// 1 audit per day per verified email. Requires a token from the
// /api/leads/verify/* flow; the raw machine demo endpoints stay IP-quota'd.
import { withAgentLog } from "../../../../lib/agent-log.js";
import { NextResponse, after } from "next/server";
import { auditSite } from "../../../../audit.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { peekKey, claimKey, hashIdentity, secondsUntilUtcMidnight } from "../../../../lib/demo-limit.js";
import { verifyToken } from "../../../../lib/leads/verify.js";
import { signReport } from "../../../../lib/report-signing.js";
import { sendFreeReportEmail } from "../../../../lib/email/resend.js";
import { upsertPublicReport, domainFromUrl } from "../../../../lib/public-reports.js";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Free audit is 1 audit/day per verified email. Agents can pay per-call at GET /api/audit (x402, $0.015 USDC).",
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
      error: "A verified email is required for the free daily audit.",
      code: "EMAIL_NOT_VERIFIED",
      for_humans: "Verify once: POST /api/leads/verify/request {email, url} → 6-digit code by email → POST /api/leads/verify/confirm {email, code} → token valid 30 days.",
    },
    { status: 401, headers: CORS }
  );
}

// One claim per verified email per UTC day — same shared-quota philosophy as
// the IP-based demo limit, keyed on the HMAC'd email instead.
function dailyEmailKey(email) {
  return `demo:${new Date().toISOString().slice(0, 10)}:email:${hashIdentity(email)}`;
}

async function handleGET(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const isPublic = req.nextUrl.searchParams.get("public") === "1";

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
    const report = await auditSite(target.href);
    // Atomic claim AFTER success: failures stay free, races can't double-spend.
    if (!(await claimKey(claimKeyForToday, secondsUntilUtcMidnight()))) return rateLimited();

    const signed = signReport({ tier: "free-verified", ...report });

    // Opt-in public listing (widget checkbox): store the signed report only —
    // never the verified email. Best-effort; a listing failure must not break
    // the audit response.
    let publicReportUrl = null;
    if (isPublic) {
      try {
        const row = await upsertPublicReport({
          url: report.url,
          score: report.website_intelligence_score ?? report.overall_score ?? null,
          report: signed,
          source: "free-verified",
        });
        if (row) publicReportUrl = `https://www.santosautomation.com/reports/${domainFromUrl(report.url)}`;
      } catch (e) {
        console.warn("public report upsert failed:", e.message);
      }
    }

    // Instant report email, post-response and fail-soft.
    after(async () => {
      try {
        const sent = await sendFreeReportEmail({
          to: email,
          targetUrl: report.url,
          score: report.website_intelligence_score ?? report.overall_score,
          topIssues: report.issues,
          publicReportUrl,
        });
        if (!sent.ok) console.warn("free report email not sent:", sent.reason);
      } catch (e) {
        console.warn("free report email failed:", e.message);
      }
    });

    return NextResponse.json(signed, { headers: CORS });
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

export const GET = withAgentLog(handleGET, "quick-audit-free");
