import test from "node:test";
import assert from "node:assert/strict";
import { generateExecutiveSummary } from "../lib/growth/executive-summary.js";
import { generateOptimizedLLMsTxt } from "../lib/growth/llms-txt-generator.js";
import { generateRobotsTxtPatch, isAllowed, parseRobots, rulesFor } from "../lib/growth/robots-patch.js";
import { generateViralTeaser, xLength } from "../lib/growth/viral-teaser.js";
import { isReliableAudit, normalizeAuditPayload, scoreEmoji } from "../lib/growth/payload.js";
import { assembleFixKit, buildFixKit } from "../lib/growth/fix-kit.js";

const finding = (id, status, severity = "moderate") => ({
  id, category: "x", severity, confidence: "high", status, title: id, recommendation: `fix ${id}`,
});

function payload(overrides = {}) {
  return {
    target: { requested_url: "https://www.acme.com", canonical_origin: "https://www.acme.com", final_url: "https://www.acme.com/" },
    profile: "general_website",
    readiness_level: { level: 0, name: "Human-only" },
    score: 38,
    grade: "F",
    confidence: 0.8,
    tested_coverage_percent: 72,
    applicability: {},
    subscores: {},
    interfaces: { llms_txt: { status: "not_found" }, openapi: [], mcp: [] },
    findings: [
      finding("agent.llms_txt.present", "fail", "high"),
      finding("agent.jsonld.identity", "fail", "moderate"),
      finding("agent.trust.https", "pass", "info"),
    ],
    recommended_actions: [{ priority: 1, finding_id: "agent.llms_txt.present", title: "Publish /llms.txt", impact: "high", effort: "medium" }],
    limitations: [],
    website_intelligence: { score: 41, dimensions: { discoverable: 22, understandable: 64, callable: null, trustworthy: 93 } },
    ...overrides,
  };
}

test("executive summary uses AI Blindspot framing and pillar statuses", () => {
  const md = generateExecutiveSummary(payload());
  assert.match(md, /^# AI Agent Readiness: acme\.com/);
  assert.match(md, /AI Blindspot/);
  assert.match(md, /Machine Invisibility/);
  assert.match(md, /\| Discoverable \| 22\/100 \| 🔴 \|/);
  assert.match(md, /\| Callable \| n\/a \| ⚪ \|/);
  assert.match(md, /\| Trustworthy \| 93\/100 \| 🟢 \|/);
  assert.doesNotMatch(md, /Operational friction/, "informational sites aren't scolded for lacking an API");
  assert.equal(generateExecutiveSummary(payload()), md, "pure: identical output for identical input");
});

test("executive summary flags integration tax when the site has functional inputs", () => {
  const md = generateExecutiveSummary(payload({ has_functional_inputs: true }));
  assert.match(md, /## Operational friction/);
  assert.match(md, /High Integration Tax for AI Procurement Agents: no OpenAPI contract or MCP server/);
});

test("executive summary adds Deep-audit accessibility evidence", () => {
  const md = generateExecutiveSummary(payload({ accessibility_violations: [{ id: "button-name", impact: "critical" }, { id: "region", impact: "minor" }] }));
  assert.match(md, /1 serious or critical accessibility violation \(`button-name`\)/);
});

test("score emoji bands", () => {
  assert.deepEqual([95, 90, 89, 60, 59, null].map(scoreEmoji), ["🟢", "🟢", "🟡", "🟡", "🔴", "⚪"]);
});

test("llms.txt follows llmstxt.org order, resolves and dedupes links, escapes titles", () => {
  const txt = generateOptimizedLLMsTxt({
    name: "Acme",
    url: "https://acme.com",
    summary: "Acme sells\nwidgets.",
    interfaces: { openapi: "/openapi.json" },
    sections: [{ title: "Docs", links: [{ title: "Guide [v2]", url: "/docs" }, { title: "Dup", url: "https://acme.com/docs#x" }, { title: "Bad", url: "javascript:alert(1)" }] }],
    optional: [{ title: "Blog", url: "/blog" }],
    contact: { email: "help@acme.com" },
  });
  assert.equal(txt, [
    "# Acme", "", "> Acme sells widgets.", "",
    "## Machine interfaces", "", "- [OpenAPI specification](https://acme.com/openapi.json): Typed contract for every API operation", "",
    "## Docs", "", "- [Guide \\[v2\\]](https://acme.com/docs)", "",
    "## Contact", "", "- Email: help@acme.com", "",
    "## Optional", "", "- [Blog](https://acme.com/blog)", "",
  ].join("\n"));
});

test("robots parser follows RFC 9309 group and longest-match rules", () => {
  const groups = parseRobots("User-agent: *\nDisallow: /\nAllow: /public\n\nUser-agent: GPTBot\nUser-agent: CCBot\nDisallow: /private\n");
  assert.equal(isAllowed(rulesFor(groups, "Googlebot"), "/"), false);
  assert.equal(isAllowed(rulesFor(groups, "Googlebot"), "/public/x"), true);
  assert.equal(isAllowed(rulesFor(groups, "GPTBot"), "/"), true, "own group replaces wildcard");
  assert.equal(isAllowed([{ type: "disallow", path: "/*.pdf$" }], "/a.pdf"), false);
  assert.equal(isAllowed([{ type: "disallow", path: "/*.pdf$" }], "/a.pdf?x"), true);
  assert.equal(isAllowed([{ type: "disallow", path: "/a" }, { type: "allow", path: "/a" }], "/a"), true, "tie goes to allow");
});

test("robots patch re-opens blocked AI bots, keeps private paths, removes conflicting groups", () => {
  const original = [
    "User-agent: *",
    "Disallow: /internal/",
    "",
    "User-agent: GPTBot",
    "User-agent: CCBot",
    "Disallow: /",
    "",
    "User-agent: ClaudeBot",
    "Disallow: /",
    "",
    "Sitemap: https://acme.com/sitemap.xml",
  ].join("\n");
  const patched = generateRobotsTxtPatch(original, { protectPaths: ["/admin/"] });
  const groups = parseRobots(patched);
  for (const bot of ["GPTBot", "ClaudeBot"]) {
    assert.equal(isAllowed(rulesFor(groups, bot), "/"), true, `${bot} re-opened`);
    assert.equal(isAllowed(rulesFor(groups, bot), "/internal/x"), false, `${bot} still kept out of /internal/`);
    assert.equal(isAllowed(rulesFor(groups, bot), "/admin/"), false);
  }
  assert.equal(isAllowed(rulesFor(groups, "CCBot"), "/"), false, "unrelated bots untouched");
  assert.match(patched, /Sitemap: https:\/\/acme\.com\/sitemap\.xml/);
  assert.doesNotMatch(patched, /User-agent: PerplexityBot/, "bots that weren't blocked aren't added");
});

test("robots patch handles a blanket wildcard block and training opt-out", () => {
  const patched = generateRobotsTxtPatch("User-agent: *\nDisallow: /\n", { includeTraining: false });
  const groups = parseRobots(patched);
  assert.equal(isAllowed(rulesFor(groups, "OAI-SearchBot"), "/"), true);
  assert.equal(isAllowed(rulesFor(groups, "GPTBot"), "/"), false, "training bot stays blocked");
  assert.equal(isAllowed(rulesFor(groups, "Googlebot"), "/"), false, "wildcard policy unchanged");
  assert.equal(generateRobotsTxtPatch("User-agent: *\nAllow: /\n"), "", "nothing blocked → no patch");
});

test("viral teaser has four lines with real scores and fits X", () => {
  const post = generateViralTeaser("https://www.acme.com/", payload());
  const lines = post.split("\n\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "acme.com scores a shocking 41/100 for AI Agent Readiness.");
  assert.equal(lines[1], "🔴 Discoverable 22 · 🟡 Understandable 64 · ⚪ Callable n/a · 🟢 Trustworthy 93");
  assert.match(lines[2], /llms\.txt/);
  assert.match(lines[3], /santosautomation\.com/);
  assert.ok(xLength(generateViralTeaser("acme.com", payload(), { platform: "x" })) <= 280);
});

test("embedded Quick audits never claim a missing llms.txt they didn't check", () => {
  const p = payload({
    interfaces: { llms_txt: { status: "not_found" }, openapi: [], mcp: [] },
    findings: [finding("agent.llms_txt.present", "unknown")],
  });
  assert.doesNotMatch(generateExecutiveSummary(p), /AI Blindspot/);
});

test("Quick reports normalize to payloads; error-page audits are unreliable", () => {
  const quick = { http_status: 200, scores: { performance: 40 }, website_intelligence: { score: 50, dimensions: { discoverable: 50 } }, agent_readiness: payload({ website_intelligence: undefined }) };
  const normalized = normalizeAuditPayload(quick);
  assert.equal(normalized.website_intelligence.score, 50);
  assert.equal(normalized.scores.performance, 40);
  assert.equal(normalizeAuditPayload({ issues: [] }), null);
  assert.equal(isReliableAudit(quick), true);
  assert.equal(isReliableAudit(payload()), true, "Agent Readiness results have no http_status");
  for (const status of [202, 403, 404, 429, 500]) assert.equal(isReliableAudit({ http_status: status }), false);
});

test("fix-it kit runs one audit and returns summary, llms.txt and robots patch", async () => {
  const html = `<html><head><title>Acme | Widgets</title><meta name="description" content="Acme sells widgets."></head>
    <body><a href="/pricing">Pricing</a><a href="/docs">Docs</a><a href="https://other.com/x">Out</a></body></html>`;
  const requested = [];
  const fetcher = async (url) => {
    requested.push(new URL(url).pathname);
    const path = new URL(url).pathname;
    const respond = (status, body, type = "text/html") => ({ response: { status, headers: new Headers({ "content-type": type }) }, body, finalUrl: url });
    if (path === "/") return respond(200, html);
    if (path === "/robots.txt") return respond(200, "User-agent: *\nDisallow: /cart/\n\nUser-agent: GPTBot\nDisallow: /\n", "text/plain");
    return respond(404, "not found");
  };
  const kit = await buildFixKit("https://acme.example", { fetcher });
  assert.equal(requested.filter((p) => p === "/").length, 1, "homepage fetched once and reused by the audit");
  assert.match(kit.executive_summary.markdown, /^# AI Agent Readiness: acme\.example/);
  assert.equal(kit.executive_summary.data.domain, "acme.example");
  assert.equal(kit.fixes.llms_txt.needed, true);
  assert.match(kit.fixes.llms_txt.content, /^# Acme\n\n> Acme sells widgets\.\n/);
  assert.match(kit.fixes.llms_txt.content, /- \[Pricing\]\(https:\/\/acme\.example\/pricing\)/);
  assert.doesNotMatch(kit.fixes.llms_txt.content, /other\.com/);
  assert.deepEqual(kit.fixes.robots_txt.blocked_ai_crawlers, ["GPTBot"]);
  assert.match(kit.fixes.robots_txt.content, /User-agent: GPTBot\nAllow: \/\nDisallow: \/cart\//);
});

test("fix-it kit omits the robots patch when robots.txt is unreachable", () => {
  const kit = assembleFixKit({ report: payload(), html: "<title>Acme</title>", robotsTxt: null });
  assert.equal(kit.fixes.robots_txt.needed, false);
  assert.equal(kit.fixes.robots_txt.content, null);
  assert.ok(kit.notes.some((note) => note.includes("robots.txt could not be fetched")));
});
