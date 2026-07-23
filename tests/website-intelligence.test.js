import test from "node:test";
import assert from "node:assert/strict";
import { websiteIntelligenceSummary, WEBSITE_INTELLIGENCE_DIMENSIONS } from "../lib/website-intelligence.js";
import { PRODUCT_PAGES, LEARN_ARTICLES, SITE_URL } from "../lib/marketing-content.js";
import sitemap from "../app/sitemap.js";
import robots from "../app/robots.js";
import { capabilityManifest } from "../lib/capabilities.js";

test("Website Intelligence synthesizes four dimensions without changing source scores", () => {
  const scores = { performance: 80, seo: 90, accessibility: 70, security: 60 };
  const original = structuredClone(scores);
  const summary = websiteIntelligenceSummary({
    scores,
    agentReadiness: {
      confidence: 0.9,
      tested_coverage_percent: 75,
      applicability: {
        discovery_and_documentation: "tested", structured_identity_and_context: "tested",
        api_readiness: "not_applicable", mcp_readiness: "not_applicable",
        agent_commerce: "not_applicable", operational_trust: "tested",
      },
      subscores: { discovery_and_documentation: 80, structured_identity_and_context: 60, operational_trust: 90 },
      findings: [
        { id: "pass", status: "pass" },
        { id: "na", status: "not_applicable" },
        { id: "unknown", status: "unknown" },
      ],
      recommended_actions: [],
    },
  });
  assert.deepEqual(scores, original);
  assert.equal(summary.dimensions.discoverable, 85);
  assert.equal(summary.dimensions.understandable, 73);
  assert.equal(summary.dimensions.callable, null);
  assert.equal(summary.applicability.callable, "not_applicable");
  assert.equal(summary.dimensions.trustworthy, 75);
  assert.equal(summary.score, 78);
  assert.deepEqual(summary.coverage, { tests_available: 3, tests_executed: 1, tests_not_applicable: 1, tests_skipped: 1, tested_percent: 75 });
});

test("callable dimension uses only applicable API, MCP, and commerce categories", () => {
  const summary = websiteIntelligenceSummary({
    scores: { seo: 80, performance: 90, security: 80 },
    agentReadiness: {
      applicability: { api_readiness: "tested", mcp_readiness: "tested", agent_commerce: "not_applicable" },
      subscores: { api_readiness: 80, mcp_readiness: 60 }, findings: [], recommended_actions: [],
    },
  });
  assert.equal(summary.dimensions.callable, 70);
  assert.equal(summary.applicability.callable, "tested");
});

test("all required product and learning pages have unique metadata", () => {
  assert.equal(Object.keys(PRODUCT_PAGES).length, 6);
  assert.equal(Object.keys(LEARN_ARTICLES).length, 8);
  assert.equal(new Set(Object.values(PRODUCT_PAGES).map((page) => page.title)).size, 6);
  assert.equal(new Set(Object.values(PRODUCT_PAGES).map((page) => page.description)).size, 6);
  assert.ok(Object.values(PRODUCT_PAGES).every((page) => page.sections.length >= 3 && page.path.startsWith("/")));
  assert.ok(Object.values(LEARN_ARTICLES).every((article) => article.sections.length >= 3));
  assert.deepEqual(WEBSITE_INTELLIGENCE_DIMENSIONS.map((item) => item.name), ["Discoverable", "Understandable", "Callable", "Trustworthy"]);
});

test("sitemap contains canonical public pages only and robots preserves machine assets", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.ok(urls.includes(`${SITE_URL}/ai-website-intelligence`));
  assert.ok(urls.includes(`${SITE_URL}/methodology/agent-readiness`));
  assert.ok(urls.includes(`${SITE_URL}/reports/sample-agent-readiness`));
  assert.ok(Object.keys(LEARN_ARTICLES).every((slug) => urls.includes(`${SITE_URL}/learn/${slug}`)));
  assert.ok(urls.every((url) => !url.includes("/api/") && !url.includes("?")));
  // robots.txt is open-by-default (Allow: /): discovery files are reachable
  // as long as no Disallow rule covers them.
  const disallows = [robots().rules[0].disallow ?? []].flat();
  const discovery = ["/.well-known/agent-capabilities.json", "/llms.txt", "/openapi.json", "/sitemap.xml"];
  assert.ok(discovery.every((path) => !disallows.some((rule) => path.startsWith(rule))));
});

test("well-known manifest presents compatible ids with complete discovery metadata", () => {
  const manifest = capabilityManifest();
  assert.equal(manifest.name, "Santos Website Intelligence API");
  assert.equal(manifest.version, "2.9.0");
  assert.equal(manifest.payment_protocols[0].protocol, "x402-v2");
  assert.ok(manifest.capabilities.some((item) => item.id === "agent-readiness.quick" && item.price.amount === "0.075"));
  assert.ok(manifest.capabilities.some((item) => item.id === "site-audit.quick"));
});
