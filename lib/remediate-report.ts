// Free-with-report access for /api/audit/remediate.
//
// A caller who bought an Agent Readiness audit can send that signed report
// back and get remediation for the same domain without paying again. Only
// paid routes sign reports (/api/agent-readiness, /api/audit, batch), so a
// valid HMAC signature is proof of purchase.
//
// The report's signed_at is deliberately outside the signature (see
// lib/report-signing.js), so it cannot be trusted for an age limit. Reuse is
// bounded instead by a per-report allowance the route claims against the
// signature, which an edited signed_at cannot change.
//
// Published reports (public=1) never qualify: anyone can download them, so
// they prove nothing about who paid.
import { verifyReportSignature } from "./report-signing.js";
import { wasReportPublished } from "./public-reports.js";
import { RemediationError, normalizeDomain, type Site } from "./remediate.ts";

/** Free remediations one paid report grants, across its whole lifetime. */
export const REPORT_FREE_USES = 5;
export const REPORT_ALLOWANCE_TTL_SECS = 365 * 24 * 60 * 60;

export interface ReportGrant {
  /** Stable identity for the allowance: the report's HMAC signature. */
  signature: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Accept only an AgentReadinessResult from /api/agent-readiness: top-level
 * findings and target. Quick Audit reports nest the result under
 * agent_readiness and cost less than this route, so they do not qualify.
 */
function readinessOrigin(report: Record<string, unknown>): string | null {
  if ("agent_readiness" in report || !Array.isArray(report.findings) || typeof report.schema_version !== "string") return null;
  const target = report.target;
  return isRecord(target) && typeof target.canonical_origin === "string" ? target.canonical_origin : null;
}

export function checkReportForSite(report: unknown, site: Site): ReportGrant {
  if (!isRecord(report) || !verifyReportSignature(report).valid) {
    throw new RemediationError("INVALID_REPORT", "report must be a signed Agent Readiness report exactly as returned by /api/agent-readiness.");
  }
  const origin = readinessOrigin(report);
  if (!origin) {
    throw new RemediationError("INVALID_REPORT", "report must come from /api/agent-readiness; other report types do not include remediation.");
  }

  let reportSite: Site;
  try {
    reportSite = normalizeDomain(new URL(origin).origin);
  } catch {
    throw new RemediationError("INVALID_REPORT", "report target is not a public domain.");
  }
  // "www." is ignored on both sides: an audit of www.acme.com covers acme.com.
  if (reportSite.name !== site.name) {
    throw new RemediationError("REPORT_DOMAIN_MISMATCH", `report covers ${reportSite.name}, not ${site.name}.`);
  }
  return { signature: report.signature as string };
}

/** Reject a report that was ever made public. Fails closed if the check cannot run. */
export async function assertReportUnpublished(report: unknown): Promise<void> {
  let published: boolean;
  try {
    published = await wasReportPublished(report);
  } catch (e) {
    console.error("[remediate] published-report check failed:", (e as Error).message);
    throw new RemediationError("REPORT_CHECK_UNAVAILABLE", "Could not verify this report right now. Retry shortly, or omit \"report\" to pay via x402.");
  }
  if (published) {
    throw new RemediationError("REPORT_PUBLISHED", "This report was published publicly, so it cannot unlock free remediation. Omit \"report\" to pay via x402, or run a new private /api/agent-readiness audit.");
  }
}
