import { NextResponse } from "next/server";
import { AuditError } from "./safe-fetch.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

// Map an audit failure to a stable machine-readable error response.
// Shape is additive over the original { error: string }.
export function auditErrorResponse(e) {
  const code = e instanceof AuditError ? e.code : "AUDIT_FAILED";
  const status = code === "AUDIT_TIMEOUT" ? 504 : code === "TARGET_UNREACHABLE" ? 502 : 400;
  return NextResponse.json(
    { error: `Could not audit: ${e.message}`, code },
    { status, headers: CORS }
  );
}

export { CORS };
