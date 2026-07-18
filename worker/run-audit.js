// Orchestrates one Deep Page Audit end-to-end and returns { report, artifacts }.
// Shared by the queue worker (worker.js) and the local test harness (run-local.js).
import { randomUUID } from "node:crypto";
import { runBrowserPass, runLighthouse } from "./engine.js";
import { normalizeAxe, normalizeLighthouse, passiveSecurity, networkFindings, accessibilityScore, SCORING_METHOD } from "./aggregate.js";
import { generateSummary } from "./ai-summary.js";
import { auditAgentReadiness } from "../lib/agent-readiness/analyze.js";
import { websiteIntelligenceSummary } from "../lib/website-intelligence.js";

const REPORT_SCHEMA_VERSION = "3.0.0";
const MAX_ARTIFACT_BYTES = Number(process.env.MAX_ARTIFACT_BYTES ?? 3 * 1024 * 1024);

const newArtifactId = () => `art_${randomUUID().replaceAll("-", "").slice(0, 20)}`;

export async function runDeepAudit(request, heartbeat = async () => {}) {
  const startedAt = Date.now();
  const { url, devices, modules, artifacts: artifactPrefs } = request;
  const moduleStatus = {};
  const findings = [];
  const artifacts = [];
  const metrics = { lab: {}, network: {}, content: {} };
  let lighthouseScores = {};
  let agentReadiness;
  const engines = {
    santos: REPORT_SCHEMA_VERSION,
    node: process.version,
  };

  const primaryDevice = devices[0] ?? "mobile";

  // ---- Stage: browser evidence + accessibility (Playwright, SSRF-guarded) ----
  await heartbeat("launching-browser", 10);
  const { browser, evidence, axeResults, navError } = await runBrowserPass(url, primaryDevice, (s) => heartbeat(s, 30));
  try {
    engines.chromium = browser.version();
  } catch { /* browser may be closed */ }

  if (navError && !evidence.main_response) {
    await browser.close().catch(() => {});
    const err = new Error(`Target navigation failed: ${navError}`);
    err.code = /timeout/i.test(navError) ? "AUDIT_TIMEOUT" : "TARGET_UNREACHABLE";
    throw err;
  }

  moduleStatus["browser_network"] = modules.includes("browser-network") ? "completed" : "not_requested";
  if (modules.includes("browser-network")) {
    findings.push(...networkFindings(evidence));
    metrics.network = {
      request_count: evidence.request_count,
      total_transfer_bytes: evidence.total_bytes,
      third_party_domain_count: evidence.third_party_domains.length,
      failed_request_count: evidence.failed_requests.length,
      console_error_count: evidence.console_errors.length,
      blocked_by_auditor: evidence.blocked_requests.length,
      resource_caps_hit: evidence.caps_hit,
    };
  }

  if (modules.includes("accessibility")) {
    const axe = normalizeAxe(axeResults);
    findings.push(...axe.findings);
    moduleStatus["accessibility"] = axe.error ? "failed" : "completed";
    if (axeResults?.testEngine?.version) engines.axe_core = axeResults.testEngine.version;
  } else {
    moduleStatus["accessibility"] = "not_requested";
  }

  let securityScore = null;
  if (modules.includes("security-passive")) {
    const sec = passiveSecurity(evidence, url);
    findings.push(...sec.findings);
    securityScore = sec.score;
    moduleStatus["security_passive"] = "completed";
  } else {
    moduleStatus["security_passive"] = "not_requested";
  }

  // Screenshots become artifacts (size-capped).
  if (artifactPrefs.screenshots) {
    for (const [kind, data] of Object.entries(evidence.screenshots)) {
      if (data && data.length <= MAX_ARTIFACT_BYTES) {
        artifacts.push({ id: newArtifactId(), type: `screenshot_${kind}`, device: primaryDevice, content_type: "image/jpeg", data });
      }
    }
  }

  // ---- Stage: Lighthouse (reuses the same Chromium over CDP; closes it) ----
  for (const device of devices) {
    const key = `lighthouse_${device}`;
    if (!modules.includes("lighthouse")) { moduleStatus[key] = "not_requested"; continue; }
    if (device !== primaryDevice) { moduleStatus[key] = "not_requested"; continue; } // one LH pass per job in v1 (browser is closed after)
    await heartbeat(`lighthouse-${device}`, 60);
    const lh = await runLighthouse(url, device, browser);
    if (lh.error) {
      moduleStatus[key] = "failed";
      findings.push({
        id: "meta.lighthouse-failed", engine: "santos", category: "meta", severity: "info",
        confidence: "high", status: "not_tested", title: "Lighthouse did not complete",
        description: lh.error, recommendation: "Retry the audit; some sites block headless measurement.",
      });
    } else {
      moduleStatus[key] = "completed";
      engines.lighthouse = lh.lhr.lighthouseVersion;
      const norm = normalizeLighthouse(lh.lhr);
      findings.push(...norm.findings);
      lighthouseScores = norm.scores;
      metrics.lab = { ...norm.metrics, source: "lighthouse-lab", device };
      if (artifactPrefs.lighthouse_json && lh.reportJson) {
        const data = Buffer.from(lh.reportJson);
        if (data.length <= MAX_ARTIFACT_BYTES * 2) artifacts.push({ id: newArtifactId(), type: "lighthouse_json", device, content_type: "application/json", data });
      }
      if (artifactPrefs.lighthouse_html && lh.reportHtml) {
        const data = Buffer.from(lh.reportHtml);
        if (data.length <= MAX_ARTIFACT_BYTES * 2) artifacts.push({ id: newArtifactId(), type: "lighthouse_html", device, content_type: "text/html", data });
      }
    }
  }
  await browser.close().catch(() => {});

  // ---- Stage: aggregate + scores (deterministic; formulas in SCORING_METHOD) ----
  await heartbeat("aggregating", 85);
  const scores = {};
  if (moduleStatus[`lighthouse_${primaryDevice}`] === "completed") {
    if (lighthouseScores.performance != null) scores.performance = lighthouseScores.performance;
    if (lighthouseScores.seo != null) scores.seo = lighthouseScores.seo;
    if (lighthouseScores["best-practices"] != null) scores.best_practices = lighthouseScores["best-practices"];
  }
  if (moduleStatus["accessibility"] === "completed") scores.accessibility = accessibilityScore(findings);
  if (securityScore != null) scores.security = securityScore;
  const scoreVals = Object.values(scores);
  if (scoreVals.length) scores.overall = Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length);

  // Kept outside the historical overall calculation so opting into this
  // module cannot silently change existing Deep Page Audit score semantics.
  if (modules.includes("agent-readiness")) {
    await heartbeat("agent-readiness", 88);
    try {
      agentReadiness = await auditAgentReadiness(url, {
        mode: "deep",
        existingPage: {
          body: evidence.rendered_html ?? "",
          finalUrl: url,
          status: evidence.main_response?.status ?? 200,
          headers: evidence.main_response?.headers ?? {},
        },
      });
      scores.agent_readiness = agentReadiness.score;
      moduleStatus.agent_readiness = "completed";
    } catch (error) {
      moduleStatus.agent_readiness = "failed";
      findings.push({
        id: "meta.agent-readiness-failed", engine: "santos", category: "meta", severity: "info",
        confidence: "high", status: "not_tested", title: "Agent Readiness did not complete",
        description: String(error.message ?? error).slice(0, 300),
        recommendation: "Retry the module or inspect the target's public machine interfaces.",
      });
    }
  } else {
    moduleStatus.agent_readiness = "not_requested";
  }

  // ---- Stage: optional grounded AI summary (never touches scores) ----
  let aiSummary;
  if (modules.includes("ai-summary")) {
    await heartbeat("ai-summary", 92);
    aiSummary = await generateSummary(findings, scores);
    moduleStatus["ai_summary"] = aiSummary.status === "completed" ? "completed" : aiSummary.status === "not_available" ? "not_available" : "failed";
  } else {
    moduleStatus["ai_summary"] = "not_requested";
  }

  const report = {
    schema_version: REPORT_SCHEMA_VERSION,
    profile: "deep-page",
    target: {
      requested_url: url,
      final_url: evidence.main_response?.final_url ?? null,
      http_status: evidence.main_response?.status ?? null,
      redirect_chain: evidence.redirect_chain,
    },
    devices,
    engines,
    module_status: moduleStatus,
    scores,
    website_intelligence_score: websiteIntelligenceSummary({ scores, agentReadiness }).score,
    website_intelligence: websiteIntelligenceSummary({ scores, agentReadiness }),
    scoring_method: SCORING_METHOD,
    metrics,
    agent_readiness: agentReadiness,
    findings,
    ai_summary: aiSummary,
    duration_ms: Date.now() - startedAt,
    limitations: [
      "Single-page audit: no crawling, no login-protected pages, no interaction flows.",
      "Lighthouse metrics are laboratory measurements and may differ from real-user (field) experience; no CrUX field data in this version.",
      "Automated accessibility testing does not establish complete WCAG conformance; needs_manual_review findings require a human.",
      "Security checks are passive (transport, headers, cookies, mixed content) — this is not a penetration test or vulnerability scan.",
      "The Lighthouse pass drives the browser directly over CDP and is not per-request SSRF-filtered like the evidence pass; worker egress policy is the second control.",
      evidence.caps_hit ? "Resource caps were hit during collection; network evidence is truncated." : null,
      navError ? `Partial data: navigation reported "${navError}" after initial response.` : null,
    ].filter(Boolean),
    generated_at: new Date().toISOString(),
  };

  return { report, artifacts };
}
