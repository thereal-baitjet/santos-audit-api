// Crawl job creation + upto payment flow. Runs on the memory store with a fake
// facilitator; the x402 server and upto client are the real libraries, signing
// with a throwaway key (nothing is ever sent on-chain).
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { x402ResourceServer } from "@x402/core/server";
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from "@x402/core/http";
import { UptoEvmScheme as UptoClient } from "@x402/evm/upto/client";
import { UptoEvmScheme as UptoServer } from "@x402/evm/upto/server";

delete process.env.DATABASE_URL;

const { parseCreateRequest, usdcToAtomic, atomicToUsdc, pageCapFor, matchesFilters, expandTemplate, LIMITS } = await import("../lib/crawl/schemas.js");
const { getStore, DuplicateAuthorizationError } = await import("../lib/crawl/store.js");
const { settleCrawlJob } = await import("../lib/crawl/settle.js");
const { buildCrawlHttpServer, requestContext, authorizationDetails, AUTH_WINDOW_SECONDS } = await import("../lib/crawl/x402.js");
const { NETWORK, SELLER } = await import("../lib/x402-server.js");

const crawl = (over = {}) => ({ url: "https://example.com/docs", budget_usdc: "1", ...over });

describe("money", () => {
  test("usdcToAtomic is exact and strict", () => {
    assert.equal(usdcToAtomic("1.5"), 1_500_000n);
    assert.equal(usdcToAtomic("0.000001"), 1n);
    assert.equal(usdcToAtomic(2), 2_000_000n);
    for (const bad of ["1.0000001", "-1", "abc", "", "1e3", undefined]) assert.throws(() => usdcToAtomic(bad), RangeError, String(bad));
  });
  test("atomicToUsdc round-trips", () => {
    assert.equal(atomicToUsdc(1_500_000n), "1.5");
    assert.equal(atomicToUsdc("5000"), "0.005");
    assert.equal(atomicToUsdc(0), "0");
  });
  test("pageCapFor = min(max_pages, budget / page price)", () => {
    assert.equal(pageCapFor(usdcToAtomic("0.05"), false, 500), 10);
    assert.equal(pageCapFor(usdcToAtomic("0.05"), true, 500), 2);
    assert.equal(pageCapFor(usdcToAtomic("10"), false, 7), 7);
  });
});

describe("parseCreateRequest", () => {
  test("crawl mode normalizes and caps pages by budget", () => {
    const { errors, normalized } = parseCreateRequest(crawl({ url: "example.com/docs", budget_usdc: "0.05" }));
    assert.deepEqual(errors, []);
    assert.equal(normalized.mode, "crawl");
    assert.equal(normalized.url, "https://example.com/docs");
    assert.equal(normalized.origin, "https://example.com");
    assert.equal(normalized.max_depth, 2);
    assert.equal(normalized.page_cap, 10);
    assert.equal(normalized.budget_atomic, "50000");
    assert.equal(normalized.respect_robots, true);
  });

  test("bulk mode dedupes before computing page_cap", () => {
    const { normalized } = parseCreateRequest({ urls: ["https://a.com/1", "https://a.com/1", "https://a.com/2"], budget_usdc: "5" });
    assert.deepEqual(normalized.urls, ["https://a.com/1", "https://a.com/2"]);
    assert.equal(normalized.page_cap, 2);
  });

  test("template range expands to same-origin URLs", () => {
    assert.deepEqual(expandTemplate("https://a.com/p/{n}", { from: 2, to: 6, step: 2 }), ["https://a.com/p/2", "https://a.com/p/4", "https://a.com/p/6"]);
    const { errors, normalized } = parseCreateRequest({ template: "https://a.com/p/{n}", range: { from: 1, to: 3 }, budget_usdc: "1" });
    assert.deepEqual(errors, []);
    assert.equal(normalized.urls.length, 3);
  });

  const rejects = {
    "two inputs": crawl({ urls: ["https://example.com/a"] }),
    "missing budget": { url: "https://example.com" },
    "budget over max": crawl({ budget_usdc: String(Number(LIMITS.maxBudgetUsdc) + 1) }),
    "budget below one rendered page": crawl({ budget_usdc: "0.01", render: true }),
    "robots disabled": crawl({ respect_robots: false }),
    "max_depth in bulk": { urls: ["https://a.com/1"], max_depth: 1, budget_usdc: "1" },
    "localhost target": crawl({ url: "http://localhost/admin" }),
    "private IP target": { urls: ["https://a.com/1", "http://10.0.0.1/"], budget_usdc: "1" },
    "mixed origins": { urls: ["https://a.com/1", "https://b.com/1"], budget_usdc: "1" },
    "http vs https is a different origin": { urls: ["https://a.com/1", "http://a.com/2"], budget_usdc: "1" },
    "pattern without leading slash": crawl({ include: ["docs/*"] }),
    "too many wildcards": crawl({ exclude: ["/" + "*a".repeat(9)] }),
    "template range too large": { template: "https://a.com/{n}", range: { from: 0, to: LIMITS.maxBulkUrls }, budget_usdc: "1" },
    "template without {n}": { template: "https://a.com/x", range: { from: 0, to: 1 }, budget_usdc: "1" },
    "callback_url": crawl({ callback_url: "https://hook.example" }),
  };
  for (const [name, body] of Object.entries(rejects)) {
    test(`rejects: ${name}`, () => assert.ok(parseCreateRequest(body).errors.length > 0, name));
  }
});

describe("matchesFilters", () => {
  test("* stays within a segment, ** crosses segments, exclude wins", () => {
    assert.ok(matchesFilters("https://a.com/docs/x", ["/docs/*"], []));
    assert.ok(!matchesFilters("https://a.com/docs/x/y", ["/docs/*"], []));
    assert.ok(matchesFilters("https://a.com/docs/x/y", ["/docs/**"], []));
    assert.ok(!matchesFilters("https://a.com/docs/private/y", ["/docs/**"], ["/docs/private/**"]));
    assert.ok(matchesFilters("https://a.com/anything", [], []));
    assert.ok(!matchesFilters("https://a.com/p?id=1", ["/p"], []), "query is part of the matched target");
    assert.ok(matchesFilters("https://a.com/a.b", ["/a.b"], []) && !matchesFilters("https://a.com/axb", ["/a.b"], []), "dot is literal");
  });
});

/* --------------------- x402 upto, end to end (no chain) --------------------- */

const FACILITATOR = "0x00000000000000000000000000000000000000f1";
function fakeFacilitator({ settleResult = { success: true, transaction: "0xsettled" } } = {}) {
  const calls = { verify: [], settle: [] };
  return {
    calls,
    async getSupported() {
      return { kinds: [{ x402Version: 2, scheme: "upto", network: NETWORK, extra: { facilitatorAddress: FACILITATOR } }], extensions: [], signers: {} };
    },
    async verify(payload, requirements) {
      calls.verify.push({ payload, requirements });
      return { isValid: true, payer: payload.payload.permit2Authorization.from };
    },
    async settle(payload, requirements) {
      calls.settle.push({ payload, requirements });
      return { ...settleResult, network: NETWORK, payer: payload.payload.permit2Authorization.from };
    },
  };
}

async function harness(facilitator = fakeFacilitator()) {
  const server = new x402ResourceServer(facilitator).register(NETWORK, new UptoServer());
  const http = buildCrawlHttpServer({ description: "test", mimeType: "application/json" }, server);
  await http.initialize();
  const account = privateKeyToAccount(generatePrivateKey());
  const client = new x402Client().register(NETWORK, new UptoClient(account));
  const post = (body, headers = {}) => requestContext(new Request("https://api.test/v1/crawl", { method: "POST", headers }), body);
  return { server, http, account, client, post, facilitator };
}

async function signFor(h, body) {
  const challenge = await h.http.processHTTPRequest(h.post(body));
  assert.equal(challenge.type, "payment-error");
  assert.equal(challenge.response.status, 402);
  const required = decodePaymentRequiredHeader(challenge.response.headers["PAYMENT-REQUIRED"]);
  return { required, payload: await h.client.createPaymentPayload(required) };
}

describe("upto payment flow", () => {
  test("402 quotes budget_usdc as the upto maximum, payable only to the seller", async () => {
    const h = await harness();
    const { required } = await signFor(h, crawl({ budget_usdc: "2.5" }));
    const [req] = required.accepts;
    assert.equal(req.scheme, "upto");
    assert.equal(req.amount, "2500000");
    assert.equal(req.payTo.toLowerCase(), SELLER.toLowerCase());
    assert.equal(req.maxTimeoutSeconds, AUTH_WINDOW_SECONDS);
    assert.ok(required.extensions?.eip2612GasSponsoring, "gas sponsoring advertised for first-time Permit2 approval");
  });

  test("bare discovery probe still gets a 402 with a placeholder quote", async () => {
    const h = await harness();
    const r = await h.http.processHTTPRequest(h.post(undefined));
    assert.equal(r.response.status, 402);
    assert.equal(decodePaymentRequiredHeader(r.response.headers["PAYMENT-REQUIRED"]).accepts[0].amount, "1000000");
  });

  test("signed authorization verifies without settling, and exposes payer/nonce/deadline", async () => {
    const h = await harness();
    const body = crawl({ budget_usdc: "2.5" });
    const { payload } = await signFor(h, body);
    const verified = await h.http.processHTTPRequest(h.post(body, { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) }));
    assert.equal(verified.type, "payment-verified");
    assert.equal(verified.paymentRequirements.amount, "2500000");
    assert.equal(h.facilitator.calls.settle.length, 0, "creation must never settle");
    const auth = authorizationDetails(verified.paymentPayload);
    assert.equal(auth.payer, h.account.address.toLowerCase());
    assert.ok(auth.nonce);
    assert.ok(Math.abs(auth.expiresAt.getTime() - (Date.now() + AUTH_WINDOW_SECONDS * 1000)) < 60_000);
  });

  test("an authorization signed for one budget does not verify for a larger one", async () => {
    const h = await harness();
    const { payload } = await signFor(h, crawl({ budget_usdc: "1" }));
    const r = await h.http.processHTTPRequest(h.post(crawl({ budget_usdc: "5" }), { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) }));
    assert.equal(r.type, "payment-error");
  });
});

/* ------------------------- store + settlement ------------------------- */

async function createVerifiedJob(h, body = crawl({ budget_usdc: "1" }), id = `crl_test${Math.random().toString(36).slice(2)}`) {
  const { payload } = await signFor(h, body);
  const verified = await h.http.processHTTPRequest(h.post(body, { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) }));
  const auth = authorizationDetails(verified.paymentPayload);
  const { normalized } = parseCreateRequest(body);
  const job = await getStore().createJob({
    id, request: normalized, requestHash: "h", network: NETWORK,
    payer: auth.payer, paymentNonce: auth.nonce, authorizationExpiresAt: auth.expiresAt,
    paymentPayload: verified.paymentPayload, paymentRequirements: verified.paymentRequirements,
  });
  return { job, auth, verified };
}

describe("store + settlement", () => {
  const store = getStore();
  beforeEach(() => store._reset());

  test("job is created authorized, unsettled, with seed pages and no payload in its public view", async () => {
    const h = await harness();
    const { job } = await createVerifiedJob(h);
    assert.equal(job.status, "queued");
    assert.equal(job.settlement_status, "authorized");
    assert.equal(job.budget_atomic, "1000000");
    assert.equal(job.payment_payload, undefined);
    assert.equal(store._pages(job.id).length, 1);
    assert.equal(await store.countOpenJobsForPayer(job.payer), 1);
  });

  test("one authorization cannot fund two jobs", async () => {
    const h = await harness();
    const { job, auth, verified } = await createVerifiedJob(h);
    await assert.rejects(
      store.createJob({ id: "crl_dup", request: job.request, requestHash: "h", network: NETWORK, payer: auth.payer, paymentNonce: auth.nonce,
        authorizationExpiresAt: auth.expiresAt, paymentPayload: verified.paymentPayload, paymentRequirements: verified.paymentRequirements }),
      DuplicateAuthorizationError
    );
  });

  test("unfinished job is not settled", async () => {
    const h = await harness();
    const { job } = await createVerifiedJob(h);
    assert.equal(await settleCrawlJob(job.id, { server: h.server }), null);
    assert.equal(h.facilitator.calls.settle.length, 0);
  });

  test("completed job is charged exactly its actual cost, once", async () => {
    const h = await harness();
    const { job } = await createVerifiedJob(h);
    store._setUsage(job.id, { status: "completed", cost_atomic: "35000", pages_fetched: 7 });
    const settled = await settleCrawlJob(job.id, { server: h.server });
    assert.equal(settled.settlement_status, "settled");
    assert.equal(settled.settled_atomic, "35000");
    assert.equal(settled.settlement_tx, "0xsettled");
    assert.equal(h.facilitator.calls.settle.length, 1);
    assert.equal(h.facilitator.calls.settle[0].requirements.amount, "35000", "settled amount overridden to actual cost");
    assert.equal(await settleCrawlJob(job.id, { server: h.server }), null, "second settle is refused");
    assert.equal(h.facilitator.calls.settle.length, 1);
    assert.equal(await store.countOpenJobsForPayer(job.payer), 0);
  });

  test("zero-cost and non-completed jobs are voided without touching the chain", async () => {
    const h = await harness();
    const a = await createVerifiedJob(h);
    store._setUsage(a.job.id, { status: "completed", cost_atomic: "0" });
    assert.equal((await settleCrawlJob(a.job.id, { server: h.server })).settlement_status, "voided");
    const b = await createVerifiedJob(h);
    store._setUsage(b.job.id, { status: "failed", cost_atomic: "20000" });
    const vb = await settleCrawlJob(b.job.id, { server: h.server });
    assert.equal(vb.settlement_status, "voided");
    assert.equal(vb.settled_atomic, "0");
    assert.equal(h.facilitator.calls.settle.length, 0);
  });

  test("expired authorization and over-budget cost fail closed without settling", async () => {
    const h = await harness();
    const a = await createVerifiedJob(h);
    store._setUsage(a.job.id, { status: "completed", cost_atomic: "5000" });
    const later = () => new Date(Date.now() + (AUTH_WINDOW_SECONDS + 60) * 1000);
    assert.equal((await settleCrawlJob(a.job.id, { server: h.server, now: later })).settlement_status, "failed");
    const b = await createVerifiedJob(h);
    store._setUsage(b.job.id, { status: "completed", cost_atomic: "2000000" });
    assert.equal((await settleCrawlJob(b.job.id, { server: h.server })).settlement_status, "failed");
    assert.equal(h.facilitator.calls.settle.length, 0);
  });

  test("facilitator decline is recorded as failed", async () => {
    const h = await harness(fakeFacilitator({ settleResult: { success: false, errorReason: "insufficient_funds" } }));
    const { job } = await createVerifiedJob(h);
    store._setUsage(job.id, { status: "completed", cost_atomic: "5000" });
    const r = await settleCrawlJob(job.id, { server: h.server });
    assert.equal(r.settlement_status, "failed");
    assert.match(r.settlement_error, /insufficient_funds/);
  });
});
