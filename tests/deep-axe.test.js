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
