export const WEBSITE_INTELLIGENCE_SCHEMA_VERSION = "1.0.0";

export const WEBSITE_INTELLIGENCE_DIMENSIONS = Object.freeze([
  {
    id: "discoverable",
    name: "Discoverable",
    question: "Can agents and search systems locate the site, its documentation, and its capabilities?",
  },
  {
    id: "understandable",
    name: "Understandable",
    question: "Can agents interpret the site's identity, meaning, products, and relationships?",
  },
  {
    id: "callable",
    name: "Callable",
    question: "Can agents invoke a documented capability with typed inputs and outputs?",
  },
  {
    id: "trustworthy",
    name: "Trustworthy",
    question: "Can agents rely on the site's safety, evidence, support, and operational quality?",
  },
]);

const isScore = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
const average = (values) => {
  const scores = values.filter(isScore);
  return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
};

function applicableAgentScore(agentReadiness, category) {
  if (!agentReadiness || agentReadiness.applicability?.[category] === "not_applicable") return null;
  const value = agentReadiness.subscores?.[category];
  return isScore(value) ? value : null;
}

function coverage(agentReadiness) {
  const findings = agentReadiness?.findings ?? [];
  if (!findings.length) {
    return {
      tests_available: 0,
      tests_executed: 0,
      tests_not_applicable: 0,
      tests_skipped: 0,
      tested_percent: 0,
    };
  }
  return {
    tests_available: findings.length,
    tests_executed: findings.filter((finding) => ["pass", "fail"].includes(finding.status)).length,
    tests_not_applicable: findings.filter((finding) => finding.status === "not_applicable").length,
    tests_skipped: findings.filter((finding) => ["unknown", "not_tested"].includes(finding.status)).length,
    tested_percent: agentReadiness.tested_coverage_percent ?? 0,
  };
}

function priorityFixes(agentReadiness) {
  const byId = new Map((agentReadiness?.findings ?? []).map((finding) => [finding.id, finding]));
  return (agentReadiness?.recommended_actions ?? []).slice(0, 5).map((action) => {
    const finding = byId.get(action.finding_id);
    return {
      severity: finding?.severity ?? action.impact ?? "moderate",
      confidence: finding?.confidence ?? "medium",
      effort: action.effort ?? "unknown",
      title: finding?.title ?? action.title,
      evidence: finding?.evidence ?? null,
      recommendation: finding?.recommendation ?? action.title,
    };
  });
}

/**
 * Adds a presentation-level Website Intelligence view without changing historical
 * Quick or Deep score semantics. A callable score is null when API/MCP/commerce
 * surfaces are not applicable; informational websites are not penalized for that.
 */
export function websiteIntelligenceSummary({ scores = {}, agentReadiness } = {}) {
  const discovery = applicableAgentScore(agentReadiness, "discovery_and_documentation");
  const identity = applicableAgentScore(agentReadiness, "structured_identity_and_context");
  const api = applicableAgentScore(agentReadiness, "api_readiness");
  const mcp = applicableAgentScore(agentReadiness, "mcp_readiness");
  const commerce = applicableAgentScore(agentReadiness, "agent_commerce");
  const operationalTrust = applicableAgentScore(agentReadiness, "operational_trust");

  const dimensions = {
    discoverable: average([scores.seo, discovery]),
    understandable: average([scores.seo, scores.accessibility, identity]),
    callable: average([api, mcp, commerce]),
    trustworthy: average([
      scores.security,
      scores.performance,
      scores.best_practices,
      scores.accessibility,
      operationalTrust,
    ]),
  };

  return {
    schema_version: WEBSITE_INTELLIGENCE_SCHEMA_VERSION,
    score: average(Object.values(dimensions)),
    dimensions,
    applicability: {
      callable: dimensions.callable == null ? "not_applicable" : "tested",
    },
    coverage: coverage(agentReadiness),
    confidence: agentReadiness?.confidence ?? null,
    priority_fixes: priorityFixes(agentReadiness),
    scoring_note:
      "A presentation-layer synthesis of completed checks. Existing overall_score and scores fields retain their historical meaning.",
  };
}
