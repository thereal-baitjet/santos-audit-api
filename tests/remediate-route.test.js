// Route-level tests for POST /api/audit/remediate, driven through the real
// handler, including the full x402 exact flow (402 challenge, signed USDC
// authorization, verify, settle) against a fake facilitator. No chain calls.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./support/next-resolve.mjs", import.meta.url);
const { NextRequest } = await import("next/server.js");
const { signReport } = await import("../lib/report-signing.js");
const { markReportPublished } = await import("../lib/public-reports.js");

const { x402ResourceServer } = await import("@x402/core/server");
const { x402Client } = await import("@x402/core/client");
const { decodePaymentRequiredHeader, encodePaymentSignatureHeader } = await import("@x402/core/http");
const { ExactEvmScheme: ExactServer } = await import("@x402/evm/exact/server");
const { ExactEvmScheme: ExactClient } = await import("@x402/evm/exact/client");
const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
const { NETWORK, SELLER } = await import("../lib/x402-server.js");
const { createRemediateHandler, remediateOptions: OPTIONS } = await import("../lib/remediate-http.ts");

const facilitator = {
  calls: { verify: 0, settle: 0 },
  async getSupported() {
    return { kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} };
  },
  async verify(payload) {
    this.calls.verify++;
    return { isValid: true, payer: payload.payload.authorization.from };
  },
  async settle(payload) {
    this.calls.settle++;
    return { success: true, transaction: "0xsettled", network: NETWORK, payer: payload.payload.authorization.from };
  },
};
const POST = createRemediateHandler(new x402ResourceServer(facilitator).register(NETWORK, new ExactServer()));
const payer = new x402Client().register(NETWORK, new ExactClient(privateKeyToAccount(generatePrivateKey())));

const URL_ = "http://localhost/api/audit/remediate";
let ipCounter = 0;
const call = (body, { contentType = "application/json", ip, headers = {} } = {}) =>
  POST(
    new NextRequest(URL_, {
      method: "POST",
      headers: { "content-type": contentType, "x-forwarded-for": ip ?? `203.0.113.${++ipCounter % 250}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

/** Unpaid call → 402 → sign the advertised terms → paid retry. */
async function payAndCall(body, options = {}) {
  const challenge = await call(body, options);
  assert.equal(challenge.status, 402);
  const required = decodePaymentRequiredHeader(challenge.headers.get("payment-required"));
  const payload = await payer.createPaymentPayload(required);
  return call(body, { ...options, headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) } });
}

const report = (origin = "https://www.route-co.com", extra = {}) =>
  signReport({ schema_version: "1.0.0", target: { requested_url: origin, canonical_origin: origin, final_url: `${origin}/` }, score: 41, findings: [], ...extra });

const request = (extra = {}) => ({
  domain: "route-co.com",
  siteDescription: "Route Co sells routes.",
  failedLayers: ["discoverable", "understandable"],
  existingEndpoints: [{ path: "/api/routes", method: "GET", desc: "List routes" }],
  ...extra,
});

test.beforeEach(() => {
  process.env.REMEDIATE_ENABLED = "true";
});

test("disabled by default: 503 until REMEDIATE_ENABLED=true", async () => {
  delete process.env.REMEDIATE_ENABLED;
  const res = await call(request({ report: report() }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).code, "SERVICE_UNAVAILABLE");
});

test("a private report grants free remediation with both artifacts", async () => {
  const res = await call(request({ report: report() }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.access, { mode: "report" });
  assert.ok(body.artifacts.llmsTxt.content.startsWith("# route-co.com\n"));
  assert.match(body.artifacts.jsonLd.content, /"@type": "Organization"/);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("each report allows five uses, then 403", async () => {
  const r = report("https://five-uses.com");
  const body = request({ domain: "five-uses.com", report: r });
  for (let i = 0; i < 5; i++) assert.equal((await call(body)).status, 200, `use ${i + 1}`);
  const sixth = await call(body);
  assert.equal(sixth.status, 403);
  assert.equal((await sixth.json()).code, "REPORT_ALLOWANCE_USED");
});

test("an invalid request with a valid report spends nothing", async () => {
  const r = report("https://no-spend.com");
  for (let i = 0; i < 3; i++) assert.equal((await call(request({ domain: "no-spend.com", siteDescription: "", report: r }))).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await call(request({ domain: "no-spend.com", report: r }))).status, 200, `use ${i + 1}`);
});

test("published, tampered, and mismatched reports are rejected", async () => {
  const published = report("https://published-co.com");
  await markReportPublished(published);
  const cases = [
    [request({ domain: "published-co.com", report: published }), "REPORT_PUBLISHED"],
    [request({ report: { ...report(), score: 99 } }), "INVALID_REPORT"],
    [request({ report: report("https://other-co.com") }), "REPORT_DOMAIN_MISMATCH"],
  ];
  for (const [body, code] of cases) {
    const res = await call(body);
    assert.equal(res.status, 403, code);
    assert.equal((await res.json()).code, code);
  }
});

test("the report path is rate limited per IP", async () => {
  const statuses = [];
  for (let i = 0; i < 31; i++) statuses.push((await call(request({ report: { not: "signed" } }), { ip: "198.51.100.7" })).status);
  assert.deepEqual(statuses.slice(0, 30), Array(30).fill(403));
  assert.equal(statuses[30], 429);
});

test("no report: 402 with $0.02 USDC terms to the seller on Base", async () => {
  const res = await call(request());
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.equal(body.code, "PAYMENT_REQUIRED");
  assert.match(body.hint, /\$0\.02 USDC/);
  const [accept] = decodePaymentRequiredHeader(res.headers.get("payment-required")).accepts;
  assert.equal(accept.network, NETWORK);
  assert.equal(accept.payTo, SELLER);
  assert.equal(accept.amount, "20000", "0.02 USDC in 6-decimal atomic units");
  assert.equal(res.headers.get("access-control-expose-headers"), "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
});

test("a paid request returns the artifacts and settles once", async () => {
  const before = { ...facilitator.calls };
  const res = await payAndCall(request());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.access, { mode: "x402" });
  assert.ok(body.artifacts.llmsTxt && body.artifacts.jsonLd);
  assert.ok(res.headers.get("payment-response"), "settlement receipt header");
  assert.equal(facilitator.calls.settle, before.settle + 1);
});

test("a paid but invalid request is rejected and never settles", async () => {
  const before = facilitator.calls.settle;
  const res = await payAndCall(request({ failedLayers: ["nope"] }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID_REQUEST");
  assert.equal(facilitator.calls.settle, before);
});

test("body errors still meet the paywall first, then fail without settling", async () => {
  const before = facilitator.calls.settle;
  for (const [options, body, status] of [
    [{ contentType: "text/plain" }, request(), 415],
    [{ contentType: "application/json-patch+json" }, request(), 415],
    [{}, "{nope", 400],
    [{}, "x".repeat(1_000_001), 413],
  ]) {
    assert.equal((await call(body, options)).status, 402, "unpaid probes always get the challenge");
    assert.equal((await payAndCall(body, options)).status, status);
  }
  assert.equal(facilitator.calls.settle, before);
});

test("report: null is treated as absent and goes to the paywall", async () => {
  assert.equal((await call(request({ report: null }))).status, 402);
});

test("OPTIONS advertises POST and the payment header", async () => {
  const res = OPTIONS();
  assert.equal(res.status, 204);
  assert.match(res.headers.get("access-control-allow-headers"), /PAYMENT-SIGNATURE/);
});
