// GET /v1/fetch/demo — one free safe fetch per day per IP (quota shared with
// the other free demos, so the free-tier surface stays one request a day).
import { NextResponse } from "next/server";
import { fetchUrl } from "../../../../lib/fetch-product.js";
import { validateTarget } from "../../../../lib/safe-fetch.js";
import { auditErrorResponse, CORS } from "../../../../lib/errors.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../../../lib/demo-limit.js";

const PRICE = process.env.SAFE_FETCH_PRICE_USDC ?? "0.002";

function rateLimited() {
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return NextResponse.json(
    { error: `Free demo is 1 request/day (shared across all demo endpoints). Agents can pay per-call at GET /v1/fetch (x402, $${PRICE}).`, code: "RATE_LIMITED" },
    { status: 429, headers: { ...CORS, "Retry-After": String(Math.ceil((midnight - Date.now()) / 1000)) } }
  );
}

export async function GET(req) {
  const ip = ipFromRequest(req);
  const url = req.nextUrl.searchParams.get("url") ?? "";

  try {
    validateTarget(url);
  } catch (e) {
    return auditErrorResponse(e);
  }

  if (!(await hasFreeAudit(ip))) return rateLimited();

  try {
    const result = await fetchUrl(url);
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
