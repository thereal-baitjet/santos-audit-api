import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAxe } from "../worker/aggregate.js";

const node = (target, messageKey) => ({ target: [target], any: [{ id: "color-contrast", data: { messageKey }, message: "msg" }], all: [], none: [] });

test("needs-review findings carry reasons, examples, and info severity", () => {
  const { findings } = normalizeAxe({
    violations: [],
    incomplete: [{
      id: "color-contrast", impact: "serious", help: "Elements must meet minimum color contrast ratio thresholds",
      description: "Ensure contrast meets WCAG 2 AA", tags: ["wcag2aa", "wcag143"],
      nodes: [node(".a", "bgGradient"), node(".b", "bgGradient"), node(".c", "pseudoContent"), node(".d", "somethingNew")],
    }],
  });
  const [f] = findings;
  assert.equal(f.status, "needs_manual_review");
  assert.equal(f.severity, "info");
  assert.equal(f.evidence.axe_impact, "serious");
  assert.equal(f.evidence.needs_review_count, 4);
  assert.equal(f.evidence.affected_count, 4);
  assert.deepEqual(f.evidence.reasons.map((r) => [r.reason, r.count]), [["bgGradient", 2], ["pseudoContent", 1], ["somethingNew", 1]]);
  assert.equal(f.evidence.reasons[0].explanation, "text sits on a gradient background");
  assert.equal(f.evidence.reasons[2].explanation, "msg", "unknown keys fall back to axe's message");
  assert.deepEqual(f.evidence.reasons[0].examples, [".a", ".b"]);
  assert.equal(f.evidence.nodes.length, 4);
  assert.match(f.description, /^4 elements need manual review: .*not confirmed failures/);
  assert.match(f.recommendation, /gradient background \(2 of 4; e\.g\. \.a\)/);
});

test("confirmed violations keep axe severity", () => {
  const { findings } = normalizeAxe({
    violations: [{ id: "image-alt", impact: "critical", help: "Images must have alt text", description: "d", tags: [], nodes: [{ target: ["img"] }] }],
    incomplete: [],
  });
  assert.equal(findings[0].severity, "critical");
  assert.equal(findings[0].status, "fail");
});

// ── Dogfood: santosautomation.com Deep Audit report (2026-10-10) ────────────

const { normalizeLighthouse } = await import("../worker/aggregate.js");
const { toHeaders, auditAgentReadiness } = await import("../lib/agent-readiness/analyze.js");
const { websiteIntelligenceSummary } = await import("../lib/website-intelligence.js");

test("browser-captured repeated headers no longer crash Deep Agent Readiness", async () => {
  // Playwright joins a repeated header with "\n"; new Headers() threw on it.
  const raw = {
    "content-type": "text/html",
    link: '<https://api.example.com/openapi.json>; rel="service-desc"\n</font.woff2>; rel=preload; as="font"',
    "set-cookie": "a=1; Path=/\nb=2; Path=/",
    "bad header": "x",
  };
  const headers = toHeaders(raw);
  assert.match(headers.get("link"), /service-desc.*, <\/font\.woff2>/);
  assert.deepEqual(headers.getSetCookie(), ["a=1; Path=/", "b=2; Path=/"]);
  assert.deepEqual([...new Set(headers.keys())].sort(), ["content-type", "link", "set-cookie"], "an invalid header is dropped, not fatal");
  assert.equal(toHeaders([["x-a", "1"], { name: "x-b", value: "2" }]).get("x-b"), "2");
  // The Quick Audit passes fetch's own Headers object; it must survive intact.
  const fetched = new Headers([["link", "<https://example.com/openapi.json>; rel=\"service-desc\""], ["set-cookie", "a=1"], ["set-cookie", "b=2"]]);
  const copied = toHeaders(fetched);
  assert.equal(copied.get("link"), fetched.get("link"));
  assert.deepEqual(copied.getSetCookie(), ["a=1", "b=2"]);

  const result = await auditAgentReadiness("https://example.com/", {
    mode: "embedded",
    existingPage: { body: "<html><head><title>x</title></head><body>hi</body></html>", finalUrl: "https://example.com/", status: 200, headers: raw },
  });
  assert.ok(Number.isFinite(result.score));
});

test("a failed Agent Readiness module yields an unavailable Website Intelligence view", () => {
  const perfect = { performance: 100, seo: 100, accessibility: 100, best_practices: 100 };
  const failed = websiteIntelligenceSummary({ scores: perfect, agentReadiness: undefined, agentReadinessStatus: "failed" });
  assert.equal(failed.score, null);
  assert.deepEqual(failed.dimensions, { discoverable: null, understandable: null, callable: null, trustworthy: null });
  assert.equal(failed.applicability.callable, "unknown");
  assert.deepEqual(failed.incomplete.missing_modules, ["agent_readiness"]);
  // Not requested keeps the historical Lighthouse-only behavior.
  assert.equal(websiteIntelligenceSummary({ scores: perfect, agentReadinessStatus: "not_requested" }).score, 100);
});

test("Lighthouse opportunities: severity follows savings, warnings not failures, no insight duplicates", () => {
  const { findings } = normalizeLighthouse({
    categories: { performance: { score: 1 } },
    audits: {
      redirects: { score: 0, scoreDisplayMode: "metricSavings", title: "Avoid multiple page redirects", metricSavings: { LCP: 230, FCP: 230 }, details: { overallSavingsMs: 230 } },
      "legacy-javascript": { score: 0.5, scoreDisplayMode: "metricSavings", title: "Legacy JavaScript", metricSavings: { LCP: 40 } },
      "legacy-javascript-insight": { score: 0.5, scoreDisplayMode: "metricSavings", title: "Legacy JavaScript insight", metricSavings: { LCP: 0 } },
      "render-blocking-insight": { score: 0.5, scoreDisplayMode: "metricSavings", title: "Render blocking requests", metricSavings: { FCP: 450 } },
      "unused-javascript": { score: 0, details: { type: "opportunity", overallSavingsMs: 1400 }, title: "Reduce unused JavaScript" },
    },
  });
  const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
  assert.ok(!byId["perf.legacy-javascript-insight"], "insight twin dropped when the classic audit also flags");
  assert.ok(byId["perf.render-blocking-insight"], "an insight with no classic twin is kept");
  assert.equal(byId["perf.redirects"].severity, "minor");
  assert.equal(byId["perf.render-blocking-insight"].severity, "moderate");
  assert.equal(byId["perf.unused-javascript"].severity, "serious");
  assert.equal(byId["perf.redirects"].evidence.savings_ms, 230);
  assert.ok(findings.every((f) => f.status === "warning"));
});
