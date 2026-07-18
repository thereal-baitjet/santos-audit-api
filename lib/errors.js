import { NextResponse } from "next/server";
import { AuditError } from "./safe-fetch.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

// Map an audit failure to a stable machine-readable error response.
// Shape is additive over the original { error: string }.
const STATUS_BY_CODE = {
  AUDIT_TIMEOUT: 504,
  TARGET_UNREACHABLE: 502,
  URL_TOO_LONG: 414,
  UNSUPPORTED_CONTENT_TYPE: 415,
  RESPONSE_TOO_LARGE: 422,
  TOO_MANY_REDIRECTS: 422,
  SERVICE_UNAVAILABLE: 503,
};

export function auditErrorResponse(e) {
  const code = e instanceof AuditError ? e.code : "AUDIT_FAILED";
  return NextResponse.json(
    { error: `Could not audit: ${e.message}`, code },
    { status: STATUS_BY_CODE[code] ?? 400, headers: CORS }
  );
}

export { CORS };
