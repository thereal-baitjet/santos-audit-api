import { NextResponse } from "next/server";
import { hasDatabase } from "./store.js";

// Deep-audit routes are dark until explicitly enabled AND durably backed in
// production. Memory-store mode is allowed only outside production so the
// flow can be developed and tested locally.
export function deepAuditGate() {
  if (process.env.DEEP_AUDIT_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "The Deep Page Audit tier is not enabled on this deployment yet. The Quick Audit at GET /api/audit remains available.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (process.env.NODE_ENV === "production" && !hasDatabase()) {
    return NextResponse.json(
      { error: "Deep audit storage is not configured (DATABASE_URL missing).", code: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

export function requireJobToken(req, jobId, verify) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || req.nextUrl.searchParams.get("token");
  if (!verify(jobId, token)) {
    return NextResponse.json(
      { error: "Missing or invalid access token for this job. Use the access_token returned when the job was created.", code: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

export const NO_STORE = { "Cache-Control": "no-store" };
