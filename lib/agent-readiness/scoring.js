import { CATEGORY_WEIGHTS, CHECK_REGISTRY, READINESS_LEVELS } from "./contract.js";

export function gradeFor(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function computeScore(findings, applicability) {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const subscores = {};
  let testedWeight = 0;
  let applicableWeight = 0;

  for (const [category, categoryWeight] of Object.entries(CATEGORY_WEIGHTS)) {
    if (applicability[category] === "not_applicable") continue;
    const checks = CHECK_REGISTRY.filter((check) => check.category === category);
    const tested = checks.filter((check) => ["pass", "fail"].includes(byId.get(check.id)?.status));
    const available = checks.reduce((sum, check) => sum + check.weight, 0);
    const testedTotal = tested.reduce((sum, check) => sum + check.weight, 0);
    const passed = tested.reduce((sum, check) => sum + (byId.get(check.id).status === "pass" ? check.weight : 0), 0);

    applicableWeight += categoryWeight;
    testedWeight += available ? categoryWeight * (testedTotal / available) : 0;
    subscores[category] = testedTotal ? Math.round((passed / testedTotal) * 100) : 0;
  }

  const score = applicableWeight
    ? Math.round(Object.entries(subscores).reduce((sum, [category, value]) => {
        return sum + value * CATEGORY_WEIGHTS[category];
      }, 0) / applicableWeight)
    : 0;

  const coverage = applicableWeight ? Math.round((testedWeight / applicableWeight) * 100) : 0;
  return { score, grade: gradeFor(score), subscores, tested_coverage_percent: coverage };
}

export function readinessLevel(interfaces, findings) {
  const passed = new Set(findings.filter((f) => f.status === "pass").map((f) => f.id));
  let level = 0;
  if (interfaces.llms_txt?.status === "found" || passed.has("agent.docs.machine_readable")) level = 1;
  if (interfaces.openapi?.some((item) => item.valid) || interfaces.structured_data_types?.includes("WebAPI") || interfaces.capability_manifests?.length) level = 2;
  if (passed.has("agent.mcp.tools") || passed.has("agent.openapi.operations")) level = 3;
  if (level >= 3 && passed.has("agent.commerce.challenge")) level = 4;
  return READINESS_LEVELS[level];
}

export function prioritizedActions(findings) {
  const impactRank = { high: 0, moderate: 1, low: 2, info: 3 };
  return findings
    .filter((f) => f.status === "fail")
    .sort((a, b) => (impactRank[a.severity] ?? 9) - (impactRank[b.severity] ?? 9) || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map((finding, index) => ({
      priority: index + 1,
      effort: finding.severity === "high" ? "medium" : "small",
      impact: finding.severity === "high" ? "high" : "moderate",
      finding_id: finding.id,
      title: finding.recommendation,
    }));
}
