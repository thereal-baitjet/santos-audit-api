// Business-Impact Translation Engine. Turns an AgentReadinessResult (plus
// optional Deep-audit Lighthouse/axe evidence) into an executive summary.
//
// Two layers so every surface renders the same words:
//   buildExecutiveSummary()    → plain data (the report page renders it as JSX)
//   generateExecutiveSummary() → Markdown (API responses, email, exports)
//
// Design rules, enforced by construction rather than by review:
// - Every engineering fact is emitted together with its consequence (see
//   impact-copy.js); no code path prints a bare finding.
// - Prose blocks are at most two sentences; everything else is bullets.
// - Pure and stateless: same payload in, identical output out, so results
//   can be cached, signed, or diffed between monthly re-audits.
import {
  PILLARS,
  bareDomain,
  failedFindings,
  hasFunctionalInputs,
  headlineScore,
  isLlmsTxtMissing,
  pillarView,
  scoreEmoji,
} from "./payload.js";
import { copyFor } from "./impact-copy.js";

/** @typedef {import("./payload.js").AuditPayload} AuditPayload */
/** @typedef {{ label: string, impact: string }} SummaryItem */
/**
 * @typedef {object} ExecutiveSummary
 * @property {string} domain
 * @property {number | null} score
 * @property {string | null} grade
 * @property {{ level: number, name: string } | null} readinessLevel
 * @property {string} verdict
 * @property {{ id: string, name: string, score: number | null, emoji: string }[]} pillars
 * @property {SummaryItem[]} exposures
 * @property {SummaryItem[]} friction
 * @property {{ priority: number, title: string, impact: string, effort: string }[]} fixFirst
 * @property {{ coveragePercent: number, confidencePercent: number }} scope
 */

const MAX_EXPOSURES = 6;
const MAX_QUICK_WINS = 5;

// Checks whose failure is reported in the dedicated "Operational friction"
// block instead of the general exposure list, so nothing is said twice.
const CALLABLE_IDS = new Set([
  "agent.openapi.discovery", "agent.openapi.valid", "agent.openapi.operations",
  "agent.openapi.schemas", "agent.openapi.auth_payment", "agent.capabilities.manifest",
  "agent.mcp.advertised", "agent.mcp.registry", "agent.mcp.transport", "agent.mcp.tools",
  "agent.mcp.structured_output", "agent.commerce.challenge", "agent.commerce.discovery",
]);

const LLMS_TXT_MISSING = {
  label: "AI Blindspot: no llms.txt",
  impact: "The site is suffering Machine Invisibility, risking Total Omission from Autonomous Discovery Engines (Perplexity, OpenAI SearchGPT). Competitors who publish a curated llms.txt get summarized and cited instead.",
};

const NOTHING_FAILED = {
  label: "None detected",
  impact: "Every tested check passed. Re-audit monthly, because AI engines keep raising the bar.",
};

function verdict(score) {
  if (score == null) return "There wasn't enough tested coverage to score this site. Treat every unknown below as a risk until it is verified.";
  if (score < 60) return "AI agents and answer engines are mostly failing to find, understand, or act on this site today. Every month this stands, AI-referred demand flows to competitors who are machine-ready.";
  if (score < 90) return "AI agents can partly use this site, but the gaps below cost citations, recommendations, and automated purchases. These fixes are small compared with the demand they unlock.";
  return "This site is among the most machine-ready on the web. The remaining items protect that lead as AI engines raise the bar.";
}

/** Callable-surface gaps; only computed for sites with functional inputs. */
function frictionItems(payload) {
  const missing = [];
  if (!payload.interfaces?.openapi?.some((item) => item.valid)) missing.push("OpenAPI contract");
  if (!payload.interfaces?.mcp?.length) missing.push("MCP server");
  const items = [];
  if (missing.length) {
    items.push({
      label: `High Integration Tax for AI Procurement Agents: no ${missing.join(" or ")}`,
      impact: "The site takes real inputs, but agents have no typed way to submit them. Each integration needs a human engineer, so autonomous buyers route to vendors who are callable today.",
    });
  }
  for (const finding of failedFindings(payload)) {
    if (!CALLABLE_IDS.has(finding.id)) continue;
    // Discovery-level failures are already covered by the "missing" item.
    if (missing.length && ["agent.openapi.discovery", "agent.mcp.advertised"].includes(finding.id)) continue;
    const { label, impact } = copyFor(finding);
    items.push({ label, impact });
  }
  return items;
}

function deepEvidenceItems(payload) {
  const items = [];
  const severe = (payload.accessibility_violations ?? []).filter((v) => v.impact === "critical" || v.impact === "serious");
  if (severe.length) {
    const rules = severe.slice(0, 3).map((v) => `\`${v.id}\``).join(", ");
    items.push({
      label: `${severe.length} serious or critical accessibility violation${severe.length === 1 ? "" : "s"} (${rules})`,
      impact: "AI browser agents navigate through the same accessibility tree screen readers use. Elements they can't identify are elements they can't click, so those conversions fail.",
    });
  }
  const perf = payload.scores?.performance;
  if (Number.isFinite(perf) && perf < 50) {
    items.push({ label: `Performance score ${perf}/100`, impact: "Slow pages hit agent fetch timeouts before content loads. A page that times out is a page the agent reports as unavailable." });
  }
  const seo = payload.scores?.seo;
  if (Number.isFinite(seo) && seo < 70) {
    items.push({ label: `SEO score ${seo}/100`, impact: "The fundamentals classic search uses are also what AI engines ground on. Weak fundamentals here compound every gap above." });
  }
  return items;
}

/** recommended_actions, tolerating older stored reports that lack `title`. */
function fixFirstItems(payload) {
  const byId = new Map((payload.findings ?? []).map((finding) => [finding.id, finding]));
  return (payload.recommended_actions ?? [])
    .map((action, index) => ({
      priority: action.priority ?? index + 1,
      title: action.title ?? byId.get(action.finding_id ?? action.id)?.recommendation,
      impact: action.impact ?? "moderate",
      effort: action.effort ?? "unknown",
    }))
    .filter((action) => action.title)
    .slice(0, MAX_QUICK_WINS);
}

/**
 * Section order follows how an executive reads: score and verdict, the four
 * pillars, exposures ranked by severity, then the cheapest fixes. Friction
 * is only reported when the site has functional inputs, so informational
 * sites aren't scolded for not shipping an API they don't need.
 *
 * @param {AuditPayload} payload
 * @returns {ExecutiveSummary}
 */
export function buildExecutiveSummary(payload) {
  const view = pillarView(payload);
  const score = headlineScore(payload);
  const friction = hasFunctionalInputs(payload) ? frictionItems(payload) : [];

  const exposures = isLlmsTxtMissing(payload) ? [LLMS_TXT_MISSING] : [];
  for (const finding of failedFindings(payload)) {
    if (exposures.length >= MAX_EXPOSURES) break;
    if (finding.id === "agent.llms_txt.present") continue; // covered by the lead item
    if (CALLABLE_IDS.has(finding.id)) continue; // friction block, or not applicable
    const { label, impact } = copyFor(finding);
    exposures.push({ label, impact });
  }
  exposures.push(...deepEvidenceItems(payload));
  if (!exposures.length && !friction.length) exposures.push(NOTHING_FAILED);

  return {
    domain: bareDomain(payload.target?.canonical_origin ?? payload.target?.requested_url ?? "this site"),
    score,
    grade: payload.grade ?? null,
    readinessLevel: payload.readiness_level ?? null,
    verdict: verdict(score),
    pillars: PILLARS.map(({ id, name }) => ({ id, name, score: view.dimensions[id] ?? null, emoji: scoreEmoji(view.dimensions[id]) })),
    exposures,
    friction,
    fixFirst: fixFirstItems(payload),
    scope: {
      coveragePercent: payload.tested_coverage_percent ?? 0,
      confidencePercent: Math.round((payload.confidence ?? 0) * 100),
    },
  };
}

const bullet = ({ label, impact }) => `- **${label}.** ${impact}`;

/**
 * Executive-ready Markdown summary of an Agent Readiness audit.
 * @param {AuditPayload} rawAuditScores
 * @returns {string}
 */
export function generateExecutiveSummary(rawAuditScores) {
  const s = buildExecutiveSummary(rawAuditScores);
  const out = [`# AI Agent Readiness: ${s.domain}`, ""];
  out.push(
    `**Santos Index ${s.score == null ? "n/a" : `${s.score}/100`}** ${scoreEmoji(s.score)}` +
      (s.grade ? ` · Grade ${s.grade}` : "") +
      (s.readinessLevel ? ` · Level ${s.readinessLevel.level}: ${s.readinessLevel.name}` : ""),
    "",
    `> ${s.verdict}`,
    "",
    "## The four pillars",
    "",
    "| Pillar | Score | Status |",
    "| --- | --- | --- |",
    ...s.pillars.map((p) => `| ${p.name} | ${p.score == null ? "n/a" : `${p.score}/100`} | ${p.emoji} |`),
    "",
  );
  if (s.exposures.length) out.push("## Critical exposures", "", ...s.exposures.map(bullet), "");
  if (s.friction.length) out.push("## Operational friction", "", ...s.friction.map(bullet), "");
  if (s.fixFirst.length) {
    out.push("## Fix first", "", ...s.fixFirst.map((a) => `${a.priority}. ${a.title} _(impact: ${a.impact}, effort: ${a.effort})_`), "");
  }
  out.push(
    "## Audit scope",
    "",
    `- Tested coverage: ${s.scope.coveragePercent}% · Confidence: ${s.scope.confidencePercent}%`,
    "- Passive public-surface audit: no logins, payments, or form submissions were made against the site.",
    "",
  );
  return out.join("\n");
}
