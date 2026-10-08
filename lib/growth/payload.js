// Shared input contract + read helpers for the growth engines (executive
// summary, viral teaser). The payload is the existing AgentReadinessResult
// (lib/agent-readiness/contract.js) with optional Deep-audit evidence merged
// in, so no engine re-derives a score: they only read and phrase.
import { websiteIntelligenceSummary } from "../website-intelligence.js";

/**
 * @typedef {"pass" | "fail" | "unknown" | "not_applicable"} FindingStatus
 *
 * @typedef {object} Finding
 * @property {string} id                 CHECK_REGISTRY id, e.g. "agent.llms_txt.present"
 * @property {string} category
 * @property {"info" | "low" | "moderate" | "high"} severity
 * @property {"low" | "medium" | "high"} confidence
 * @property {FindingStatus} status
 * @property {string} title
 * @property {string} recommendation
 * @property {object} [evidence]
 *
 * @typedef {object} PillarScores        0–100, or null when not applicable
 * @property {number | null} discoverable
 * @property {number | null} understandable
 * @property {number | null} callable
 * @property {number | null} trustworthy
 *
 * @typedef {object} LighthouseScores    Deep audit category scores, 0–100
 * @property {number} [performance]
 * @property {number} [seo]
 * @property {number} [accessibility]
 * @property {number} [best_practices]
 * @property {number} [security]
 *
 * @typedef {object} AxeViolation
 * @property {string} id                 axe rule id, e.g. "image-alt"
 * @property {"minor" | "moderate" | "serious" | "critical"} impact
 * @property {string} [help]
 * @property {number} [nodes]            affected element count
 *
 * @typedef {object} AuditPayload
 * @property {{ requested_url: string, canonical_origin: string, final_url: string }} target
 * @property {string} profile
 * @property {{ level: number, name: string }} readiness_level
 * @property {number} score
 * @property {"A" | "B" | "C" | "D" | "F"} grade
 * @property {number} confidence
 * @property {number} tested_coverage_percent
 * @property {Record<string, "tested" | "not_applicable" | "unknown">} applicability
 * @property {Record<string, number>} subscores
 * @property {Record<string, any>} interfaces
 * @property {Finding[]} findings
 * @property {{ priority: number, finding_id: string, title: string, impact: string, effort: string }[]} recommended_actions
 * @property {string[]} limitations
 * @property {{ score: number | null, dimensions: PillarScores }} [website_intelligence]
 * @property {number | null} [website_intelligence_score]
 * @property {LighthouseScores} [scores]                  Deep audit only
 * @property {AxeViolation[]} [accessibility_violations]  Deep audit only
 * @property {boolean} [has_functional_inputs]  Caller-supplied: the site has forms, search, booking, checkout, etc.
 */

export const PILLARS = Object.freeze([
  { id: "discoverable", name: "Discoverable" },
  { id: "understandable", name: "Understandable" },
  { id: "callable", name: "Callable" },
  { id: "trustworthy", name: "Trustworthy" },
]);

/**
 * Accept every stored report shape and return an AuditPayload, or null.
 * - Agent Readiness / Deep results already are payloads.
 * - Quick Audit reports (incl. every Santos Index seed row) embed the result
 *   under `agent_readiness`, with the 4-pillar view and Lighthouse-style
 *   scores at the top level; those are lifted onto the payload.
 * @param {any} report
 * @returns {AuditPayload | null}
 */
export function normalizeAuditPayload(report) {
  if (!report || typeof report !== "object") return null;
  if (report.agent_readiness && typeof report.agent_readiness === "object") {
    return {
      ...report.agent_readiness,
      website_intelligence: report.website_intelligence ?? report.agent_readiness.website_intelligence,
      scores: report.scores ?? report.agent_readiness.scores,
    };
  }
  return Array.isArray(report.findings) ? report : null;
}

/**
 * Whether a stored report reflects the real site. Quick reports record the
 * homepage HTTP status; a non-2xx (bot wall 403/429, 202 challenge page, 404)
 * means the findings describe an error page, not the site, so no public or
 * executive claim should be made from it.
 * @param {any} report  raw stored report (before normalizeAuditPayload)
 */
export function isReliableAudit(report) {
  const status = report?.http_status;
  return status == null || (status >= 200 && status < 300 && status !== 202);
}

/**
 * Prefer the 4-pillar view already embedded in the result; fall back to
 * computing it so older stored payloads (pre-website_intelligence) still work.
 * @param {AuditPayload} payload
 * @returns {{ score: number | null, dimensions: PillarScores }}
 */
export function pillarView(payload) {
  if (payload.website_intelligence?.dimensions) return payload.website_intelligence;
  return websiteIntelligenceSummary({ scores: payload.scores, agentReadiness: payload });
}

/** Headline number: the 4-pillar score when present, else the readiness score. */
export function headlineScore(payload) {
  return pillarView(payload).score ?? payload.score;
}

/**
 * @param {AuditPayload} payload
 * @param {string} id
 * @returns {FindingStatus | undefined}
 */
export function statusOf(payload, id) {
  return payload.findings?.find((finding) => finding.id === id)?.status;
}

/** Failed findings, most severe first, ties broken by id for stable output. */
export function failedFindings(payload) {
  const rank = { high: 0, moderate: 1, low: 2, info: 3 };
  return (payload.findings ?? [])
    .filter((finding) => finding.status === "fail")
    .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.id.localeCompare(b.id));
}

/**
 * The finding is authoritative: in embedded Quick mode llms.txt is never
 * fetched (finding "unknown") while interfaces.llms_txt keeps its
 * "not_found" default, so the interface status alone would be a false claim.
 */
export function isLlmsTxtMissing(payload) {
  const status = statusOf(payload, "agent.llms_txt.present");
  if (status) return status === "fail";
  return payload.interfaces?.llms_txt?.status === "not_found";
}

/**
 * "Functional inputs" = the site does things a buyer would want an agent to
 * do. The passive audit never submits forms, so an explicit caller flag wins;
 * otherwise a non-general profile or any tested API/MCP/commerce category
 * implies there is something callable that agents should be able to reach.
 */
export function hasFunctionalInputs(payload) {
  if (typeof payload.has_functional_inputs === "boolean") return payload.has_functional_inputs;
  if (payload.profile && payload.profile !== "general_website" && payload.profile !== "documentation_site") return true;
  const a = payload.applicability ?? {};
  return ["api_readiness", "mcp_readiness", "agent_commerce"].some((category) => a[category] === "tested");
}

/** 🟢 90+, 🟡 60–89, 🔴 below 60, ⚪ not applicable. */
export function scoreEmoji(score) {
  if (score == null) return "⚪";
  if (score >= 90) return "🟢";
  if (score >= 60) return "🟡";
  return "🔴";
}

export function bareDomain(input) {
  try {
    return new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`).hostname.replace(/^www\./, "");
  } catch {
    return String(input).trim();
  }
}
