import { withAgentLog } from "../../../lib/agent-log.js";
// POST /v1/verify — free report-signature verification. Body is the full
// report JSON exactly as returned by an audit endpoint (or stored in
// public_reports); nothing is stripped before verification. Rate-limited to
// 30 verifications per IP per hour using the demo-limit slot pattern
// (fixed window emulated with N slot keys, like lib/leads/verify.js).
import { NextResponse } from "next/server";
import { CORS } from "../../../lib/errors.js";
import { verifyReportSignature } from "../../../lib/report-signing.js";
import { claimKey, hashIdentity, ipFromRequest } from "../../../lib/demo-limit.js";

const MAX_BODY_BYTES = 1_000_000; // ~1MB
const VERIFICATIONS_PER_HOUR = 30;

const hourBlock = () => Math.floor(Date.now() / 3_600_000);

// Consume one of the 30 hourly slots for this IP; false when the window is
// full. Fails open on storage outage, like the rest of the limiter.
async function consumeVerifySlot(ip) {
  const window = hourBlock();
  const ipHash = hashIdentity(ip);
  for (let slot = 1; slot <= VERIFICATIONS_PER_HOUR; slot++) {
    if (await claimKey(`verify-api:ip:${ipHash}:${window}:${slot}`, 3600)) return true;
  }
  return false;
}

function rateLimited() {
  return NextResponse.json(
    { error: "Verification is limited to 30 requests per hour per IP.", code: "RATE_LIMITED" },
    { status: 429, headers: { ...CORS, "Retry-After": "3600" } }
  );
}

function scoreOf(report) {
  const score = report.website_intelligence_score ?? report.overall_score ?? report.score ?? null;
  return Number.isFinite(score) ? score : null;
}

async function handlePOST(req) {
  const ip = ipFromRequest(req);

  // Cheap pre-check, then an exact check on the buffered body.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Body too large — a report is well under 1MB.", code: "BODY_TOO_LARGE" },
      { status: 413, headers: CORS }
    );
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Body too large — a report is well under 1MB.", code: "BODY_TOO_LARGE" },
      { status: 413, headers: CORS }
    );
  }

  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Body must be the full report JSON returned by a Santos audit endpoint.", code: "INVALID_JSON" },
      { status: 400, headers: CORS }
    );
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return NextResponse.json(
      { error: "Body must be a single report JSON object.", code: "INVALID_JSON" },
      { status: 400, headers: CORS }
    );
  }

  if (!(await consumeVerifySlot(ip))) return rateLimited();

  const { valid } = verifyReportSignature(report);
  return NextResponse.json(
    {
      valid,
      url: report.url ?? report.target?.final_url ?? null,
      score: scoreOf(report),
      signed_at: typeof report.signed_at === "string" ? report.signed_at : null,
    },
    { headers: CORS }
  );
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

export const POST = withAgentLog(handlePOST, "verify-report");
