// Regressions from dogfooding the Quick Audit on santosautomation.com
// (2026-10-10): it scored 88 while the full Agent Readiness run scored 100.
import test from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { imageAltStats } from "../audit.js";
import { auditAgentReadiness } from "../lib/agent-readiness/analyze.js";

test("alt=\"\" and hidden images are decorative, not missing alt text", () => {
  const $ = cheerio.load(`
    <img src="logo.svg" alt="">
    <img src="me.png" alt="Founder portrait">
    <img src="flourish.svg" role="presentation">
    <img src="icon.svg" aria-hidden="true">
    <img src="chart.png">
  `);
  assert.deepEqual(imageAltStats($), { missing: 1, decorative: 3 });
});

const origin = "https://pay.example";
const commerceHome = `<!doctype html><html><head><title>Pay Example API</title></head>
  <body><main><h1>Pay Example</h1><p>Our API is machine-payable over x402 in USDC, pay per call.</p></main></body></html>`;

function fetcher(routes) {
  return async (url) => {
    const route = routes[url] ?? { status: 404, body: "not found", type: "text/plain" };
    return { response: { status: route.status, headers: new Headers({ "content-type": route.type ?? "text/html" }) }, body: route.body, finalUrl: url, ttfbMs: 1, totalMs: 2 };
  };
}
const status = (report, id) => report.findings.find((f) => f.id === id)?.status;

test("embedded mode leaves undocumented commerce behavior unknown, not failed", async () => {
  const report = await auditAgentReadiness(`${origin}/`, {
    mode: "embedded",
    maxFetches: 0,
    existingPage: { body: commerceHome, finalUrl: `${origin}/`, status: 200, headers: { "content-type": "text/html" } },
  });
  assert.equal(report.applicability.agent_commerce, "tested");
  assert.equal(status(report, "agent.commerce.idempotency"), "unknown");
  assert.equal(status(report, "agent.commerce.errors"), "unknown");
});

test("when llms.txt was examined, missing commerce docs still fail", async () => {
  const report = await auditAgentReadiness(`${origin}/`, {
    fetcher: fetcher({
      [`${origin}/`]: { status: 200, body: commerceHome },
      [`${origin}/llms.txt`]: { status: 200, body: "# Pay Example\n\n> Pay per call API.\n", type: "text/plain" },
    }),
  });
  assert.equal(status(report, "agent.commerce.idempotency"), "fail");
  assert.equal(status(report, "agent.commerce.errors"), "fail");
});

test("documented commerce behavior passes in either mode", async () => {
  const documented = commerceHome.replace("pay per call.", "pay per call. Payment settles only on success; retries are idempotent.");
  const report = await auditAgentReadiness(`${origin}/`, {
    mode: "embedded",
    maxFetches: 0,
    existingPage: { body: documented, finalUrl: `${origin}/`, status: 200, headers: {} },
  });
  assert.equal(status(report, "agent.commerce.idempotency"), "pass");
  assert.equal(status(report, "agent.commerce.errors"), "pass");
});
