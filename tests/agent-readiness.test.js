import test from "node:test";
import assert from "node:assert/strict";
import { auditAgentReadiness } from "../lib/agent-readiness/analyze.js";
import { gradeFor } from "../lib/agent-readiness/scoring.js";
import { assertAgentReadinessResult } from "../lib/agent-readiness/validation.js";
import { quickOverallScore } from "../audit.js";
import { validateCreateRequest } from "../lib/deep/schemas.js";
import { getAgentReadinessPriceUsdc, usdcAtomicAmount } from "../lib/agent-readiness/product-pricing.js";

const origin = "https://service.example";

function response(status, body = "", headers = {}) {
  return { status, body, headers: new Headers({ "content-type": "text/html", ...headers }) };
}

function mockFetcher(routes, calls = []) {
  return async (url, headers, options) => {
    const method = options?.method ?? "GET";
    calls.push({ url, method, headers, body: options?.body });
    const route = routes[`${method} ${url}`] ?? routes[url] ?? response(404, "not found", { "content-type": "text/plain" });
    if (route.error) throw route.error;
    return {
      response: { status: route.status, headers: route.headers },
      body: route.body,
      finalUrl: url,
      ttfbMs: 1,
      totalMs: 2,
    };
  };
}

test("general websites receive N/A for API, MCP, and commerce", async () => {
  const calls = [];
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, "<!doctype html><html><head><title>Plain site</title></head><body><main><h1>Plain public website</h1><p>Helpful public information and contact details for visitors.</p></main></body></html>"),
    }, calls),
  });
  assert.equal(report.profile, "general_website");
  assert.equal(report.applicability.api_readiness, "not_applicable");
  assert.equal(report.applicability.mcp_readiness, "not_applicable");
  assert.equal(report.applicability.agent_commerce, "not_applicable");
  assert.ok(report.findings.filter((f) => ["api_readiness", "mcp_readiness", "agent_commerce"].includes(f.category)).every((f) => f.status === "not_applicable"));
  assert.ok(calls.length <= 8);
  assert.equal(assertAgentReadinessResult(report), report);
});

test("discovers and structurally validates an advertised OpenAPI document", async () => {
  const openapi = {
    openapi: "3.1.0", info: { title: "Example API" },
    paths: { "/things": { get: { operationId: "listThings", summary: "List things", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "array", items: { type: "string" } } } } }, 400: { description: "Bad", content: { "application/json": { schema: { type: "object" } } } } } } } },
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
  };
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, `<html><head><link rel="service-desc" href="/openapi.json"><script type="application/ld+json">{"@context":"https://schema.org","@type":["Organization","WebAPI"]}</script></head><body><main><h1>Example API</h1><p>Developer documentation, API reference, errors, limits, privacy, and support.</p></main></body></html>`),
      [`${origin}/openapi.json`]: response(200, JSON.stringify(openapi), { "content-type": "application/json" }),
    }),
  });
  assert.equal(report.profile, "api_provider");
  assert.equal(report.applicability.api_readiness, "tested");
  assert.equal(report.interfaces.openapi[0].valid, true);
  assert.equal(report.findings.find((f) => f.id === "agent.openapi.operations")?.status, "pass");
});

test("MCP probing performs initialize and tools/list but never tools/call", async () => {
  const calls = [];
  const rpcHeaders = { "content-type": "application/json", "mcp-session-id": "test-session" };
  const fetcher = async (url, headers, options) => {
    const method = options?.method ?? "GET";
    calls.push({ url, method, headers, body: options?.body });
    if (url === `${origin}/`) return { response: { status: 200, headers: new Headers({ "content-type": "text/html" }) }, body: `<html><head><link rel="mcp" href="/mcp"></head><body><main><h1>Public MCP server</h1><p>Model Context Protocol endpoint documentation with safety, limits, and support.</p></main></body></html>`, finalUrl: url };
    if (method === "POST" && JSON.parse(options.body).method === "initialize") return { response: { status: 200, headers: new Headers(rpcHeaders) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-11-25", capabilities: { tools: {} } } }), finalUrl: url };
    if (method === "POST" && JSON.parse(options.body).method === "tools/list") return { response: { status: 200, headers: new Headers({ "content-type": "application/json" }) }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "lookup", inputSchema: { type: "object", properties: {}, additionalProperties: false }, outputSchema: { type: "object" }, annotations: { readOnlyHint: true } }] } }), finalUrl: url };
    return { response: { status: 404, headers: new Headers({ "content-type": "text/plain" }) }, body: "not found", finalUrl: url };
  };
  const probed = await auditAgentReadiness(origin, { fetcher, mcpProbe: true });
  const methods = calls.filter((c) => c.method === "POST").map((c) => JSON.parse(c.body).method);
  assert.deepEqual(methods, ["initialize", "tools/list"]);
  assert.equal(probed.findings.find((f) => f.id === "agent.mcp.tools")?.status, "pass");
});

test("x402 inspection is an unsigned challenge read only", async () => {
  const calls = [];
  const terms = Buffer.from(JSON.stringify({ x402Version: 2, resource: { url: `${origin}/api/audit?url=example.com` }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "5000", asset: "0xusdc", payTo: "0xpayee" }] })).toString("base64");
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, `<html><body><main><h1>Machine-payable API</h1><p>x402 USDC pay per request API documentation includes idempotency, duplicate retry behavior, settlement failures, receipts, privacy, limits, and support.</p><a href="/api/audit?url=https%3A%2F%2Fexample.com">Paid resource</a></main></body></html>`),
      [`${origin}/api/audit?url=https%3A%2F%2Fexample.com`]: response(402, JSON.stringify({ code: "PAYMENT_REQUIRED" }), { "content-type": "application/json", "payment-required": terms }),
    }, calls),
  });
  const challenge = report.findings.find((f) => f.id === "agent.commerce.challenge");
  assert.equal(challenge?.status, "pass");
  assert.equal(challenge?.evidence.payment_signature_sent, false);
  assert.equal(challenge?.evidence.normalized_amount, "0.005");
  assert.equal(report.interfaces.pricing.status, "consistent");
  assert.equal(report.interfaces.pricing.enforced.amount, "0.005");
  assert.equal(report.findings.find((f) => f.id === "agent.commerce.discovery")?.status, "pass");
  assert.ok(calls.every((call) => !Object.keys(call.headers).some((name) => name.toLowerCase() === "payment-signature")));
});

test("flags a documented price that contradicts the enforced x402 amount", async () => {
  const terms = Buffer.from(JSON.stringify({ x402Version: 2, resource: { url: `${origin}/api/audit?url=example.com` }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "5000", asset: "0xusdc", payTo: "0xpayee" }] })).toString("base64");
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, `<html><body><main><h1>Paid API</h1><p>x402 v2 pricing: GET /api/audit?url=example.com costs $0.010 USDC per request on Base mainnet. Retry and duplicate requests are idempotent; settlement failures produce receipts and support guidance.</p><a href="/api/audit?url=example.com">Paid resource</a></main></body></html>`),
      [`${origin}/api/audit?url=example.com`]: response(402, JSON.stringify({ code: "PAYMENT_REQUIRED" }), { "content-type": "application/json", "payment-required": terms }),
    }),
  });
  assert.equal(report.interfaces.pricing.status, "contradictory");
  assert.ok(report.interfaces.pricing.contradictions.some((item) => item.field === "amount" && item.documented.amount === "0.01" && item.enforced.amount === "0.005"));
  assert.equal(report.findings.find((f) => f.id === "agent.commerce.discovery")?.status, "fail");
  assert.equal(report.findings.find((f) => f.id === "agent.metadata.consistency")?.status, "fail");
});

test("allows distinct prices for separately scoped capabilities", async () => {
  const terms = Buffer.from(JSON.stringify({ x402Version: 2, resource: { url: `${origin}/api/audit?url=example.com` }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "5000", asset: "0xusdc", payTo: "0xpayee" }] })).toString("base64");
  const manifest = {
    manifest_type: "vendor-capabilities",
    capabilities: [
      { id: "quick", description: "Quick audit", endpoint: `${origin}/api/audit?url={url}`, method: "GET", billing_unit: "successful audit", access: "x402 v2", price: { amount: "0.005", currency: "USDC", network: "eip155:8453", protocol: "x402-v2" } },
      { id: "deep", description: "Deep audit", endpoint: `${origin}/v1/audits`, method: "POST", billing_unit: "bounded compute reservation", access: "x402 v2", price: { amount: "0.075", currency: "USDC", network: "eip155:8453", protocol: "x402-v2" } },
    ],
  };
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, `<html><head><link rel="service" href="/capabilities.json"></head><body><main><h1>Audit API</h1><p>Machine-payable x402 audit services with documented retries, settlement failures, receipts, privacy, limits, and support.</p><a href="/api/audit?url=example.com">Paid quick audit</a></main></body></html>`),
      [`${origin}/capabilities.json`]: response(200, JSON.stringify(manifest), { "content-type": "application/json" }),
      [`${origin}/api/audit?url=example.com`]: response(402, JSON.stringify({ code: "PAYMENT_REQUIRED" }), { "content-type": "application/json", "payment-required": terms }),
    }),
  });
  assert.equal(report.interfaces.pricing.status, "consistent");
  assert.deepEqual(report.interfaces.pricing.claims.filter((claim) => claim.source === "capability_manifest").map((claim) => claim.amount).sort(), ["0.005", "0.075"]);
  assert.equal(report.interfaces.pricing.contradictions.length, 0);
});

test("request and embedded modes honor their budgets", async () => {
  const calls = [];
  const fetcher = mockFetcher({ [`${origin}/`]: response(200, "<html><body><main><h1>Docs</h1><p>Public documentation for agents and visitors with contact and privacy details.</p></main></body></html>") }, calls);
  const bounded = await auditAgentReadiness(origin, { fetcher, maxFetches: 2 });
  assert.equal(bounded.fetch_budget.fetches_used, 2);
  assert.equal(calls.length, 2);

  const embedded = await auditAgentReadiness(origin, { mode: "embedded", maxFetches: 0, fetcher: async () => { throw new Error("must not fetch"); }, existingPage: { body: "<html><body><h1>Existing page</h1></body></html>", finalUrl: `${origin}/` } });
  assert.equal(embedded.fetch_budget.fetches_used, 0);
});

test("follows explicitly advertised API subdomains but not unrelated origins", async () => {
  const calls = [];
  const openapi = JSON.stringify({ openapi: "3.1.0", info: { title: "Related API" }, paths: { "/ping": { get: { operationId: "ping", summary: "Ping", responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } }, 400: { description: "Bad", content: { "application/json": { schema: { type: "object" } } } } } } } } });
  const report = await auditAgentReadiness(origin, {
    fetcher: mockFetcher({
      [`${origin}/`]: response(200, `<html><head><link rel="service-desc" href="https://api.service.example/openapi.json"><link rel="service-desc" href="https://evil.example/openapi.json"></head><body><main><h1>API docs</h1><p>Developer API documentation, support, privacy, errors, and limits.</p></main></body></html>`),
      "https://api.service.example/openapi.json": response(200, openapi, { "content-type": "application/json" }),
    }, calls),
  });
  assert.equal(report.interfaces.openapi[0]?.valid, true);
  assert.ok(calls.some((call) => call.url === "https://api.service.example/openapi.json"));
  assert.ok(calls.every((call) => !call.url.startsWith("https://evil.example")));
});

test("caches bounded MCP Registry results for the configured TTL", async () => {
  const target = "https://registry-cache.example";
  const registry = "https://registry.test/v0.1/servers?limit=100";
  const calls = [];
  const fetcher = mockFetcher({
    [`${target}/`]: response(200, `<html><head><link rel="mcp" href="/mcp"></head><body><main><h1>MCP server</h1><p>Model Context Protocol documentation, support, privacy, and limits.</p></main></body></html>`),
    [registry]: response(200, JSON.stringify({ servers: [{ name: "com.example/cache", remotes: [{ url: `${target}/mcp` }] }] }), { "content-type": "application/json" }),
  }, calls);
  const options = { fetcher, registryLookup: true, registryBaseUrl: "https://registry.test", cacheTtlSeconds: 60 };
  const first = await auditAgentReadiness(target, options);
  const second = await auditAgentReadiness(target, options);
  assert.equal(calls.filter((call) => call.url === registry).length, 1);
  assert.equal(first.findings.find((f) => f.id === "agent.mcp.registry")?.status, "pass");
  assert.equal(second.findings.find((f) => f.id === "agent.mcp.registry")?.evidence.cached, true);
});

test("grade thresholds are stable", () => {
  assert.deepEqual([[90, "A"], [80, "B"], [70, "C"], [60, "D"], [59, "F"]].map(([score]) => gradeFor(score)), ["A", "B", "C", "D", "F"]);
});

test("Agent Readiness has a validated 0.025 USDC paid default", () => {
  const previous = process.env.AGENT_READINESS_PRICE_USDC;
  try {
    delete process.env.AGENT_READINESS_PRICE_USDC;
    assert.equal(getAgentReadinessPriceUsdc(), "0.025");
    assert.equal(usdcAtomicAmount(), "25000");
    process.env.AGENT_READINESS_PRICE_USDC = "0.030000";
    assert.equal(getAgentReadinessPriceUsdc(), "0.03");
    assert.equal(usdcAtomicAmount(), "30000");
    process.env.AGENT_READINESS_PRICE_USDC = "0";
    assert.throws(() => getAgentReadinessPriceUsdc(), /positive USDC amount/);
    process.env.AGENT_READINESS_PRICE_USDC = "0.0000001";
    assert.throws(() => getAgentReadinessPriceUsdc(), /positive USDC amount/);
  } finally {
    if (previous === undefined) delete process.env.AGENT_READINESS_PRICE_USDC;
    else process.env.AGENT_READINESS_PRICE_USDC = previous;
  }
});

test("Quick Audit overall score ignores additive Agent Readiness", () => {
  const scores = { performance: 100, seo: 80, accessibility: 60, security: 40, agent_readiness: 0 };
  assert.equal(quickOverallScore(scores), 70);
});

test("Deep Page request accepts the opt-in agent-readiness module", () => {
  assert.deepEqual(validateCreateRequest({ url: "https://example.com", modules: ["agent-readiness"] }), []);
});
