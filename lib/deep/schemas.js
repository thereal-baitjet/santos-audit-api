// Shared contracts for the Deep Page Audit platform. Used by the control
// plane (job API), the worker, discovery metadata, and tests — one source of
// truth so runtime behavior, OpenAPI, and Bazaar/MCP output can't drift.

export const REPORT_SCHEMA_VERSION = "3.0.0";

export const JOB_STATES = [
  "queued",
  "running",
  "aggregating",
  "completed",
  "failed",
  "expired",
  "cancelled",
];

export const TERMINAL_STATES = ["completed", "failed", "expired", "cancelled"];

export const PROFILES = ["deep-page"];

export const MODULES = [
  "lighthouse",       // mobile Lighthouse run (desktop via devices)
  "accessibility",    // rendered axe-core
  "browser-network",  // console errors, request inventory, third parties
  "security-passive", // headers, cookies, mixed content — passive only
  "ai-summary",       // optional Claude-grounded remediation summary
];

export const DEFAULT_MODULES = ["lighthouse", "accessibility", "browser-network", "security-passive"];

export const DEVICES = ["mobile", "desktop"];

export const FINDING_SEVERITIES = ["info", "minor", "moderate", "serious", "critical"];
export const FINDING_CONFIDENCE = ["low", "medium", "high"];
export const FINDING_STATUSES = ["pass", "fail", "warning", "not_applicable", "not_tested", "needs_manual_review"];

export const MODULE_STATUSES = ["completed", "failed", "timed_out", "not_requested", "not_available"];

// What the $DEEP_AUDIT_PRICE_USDC payment buys. Quoted verbatim in docs and
// discovery metadata — keep this the single copy.
export const PAYMENT_CONTRACT =
  "Payment purchases one bounded compute reservation: the job is validated, enqueued, and executed once with the configured module set and resource limits (browser time, requests, bytes). Payment settles when the job is accepted — not on report completion. If our infrastructure fails the job (worker crash after retries), contact support for a replacement run; a target site that is slow, broken, or blocks the auditor is a completed audit of that behavior, not a refund case.";

export function validateCreateRequest(body) {
  const errors = [];
  if (!body || typeof body !== "object") return ["body must be a JSON object"];

  if (typeof body.url !== "string" || !body.url.trim()) errors.push("url (string) is required");

  if (body.profile !== undefined && !PROFILES.includes(body.profile)) {
    errors.push(`profile must be one of: ${PROFILES.join(", ")}`);
  }
  if (body.devices !== undefined) {
    if (!Array.isArray(body.devices) || body.devices.length === 0 || !body.devices.every((d) => DEVICES.includes(d))) {
      errors.push(`devices must be a non-empty array drawn from: ${DEVICES.join(", ")}`);
    }
  }
  if (body.modules !== undefined) {
    if (!Array.isArray(body.modules) || body.modules.length === 0 || !body.modules.every((m) => MODULES.includes(m))) {
      errors.push(`modules must be a non-empty array drawn from: ${MODULES.join(", ")}`);
    }
  }
  if (body.callback_url !== undefined && body.callback_url !== null) {
    errors.push("callback_url is not supported yet — poll status_url or events");
  }
  return errors;
}

// Normalized create request → what gets stored on the job row.
export function normalizeCreateRequest(body) {
  return {
    url: body.url.trim(),
    profile: body.profile ?? "deep-page",
    devices: body.devices ?? ["mobile"],
    modules: body.modules ?? DEFAULT_MODULES,
    artifacts: {
      screenshots: body.artifacts?.screenshots !== false,
      lighthouse_json: body.artifacts?.lighthouse_json !== false,
      lighthouse_html: body.artifacts?.lighthouse_html === true,
    },
  };
}
