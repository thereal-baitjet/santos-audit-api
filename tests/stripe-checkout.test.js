// Input-validation tests for the Stripe checkout + webhook paths. These run
// without network/Stripe: they exercise the pure validation and idempotency
// logic, so `npm test` never touches real payments.
import test from "node:test";
import assert from "node:assert/strict";

import { validateTarget, AuditError } from "../lib/safe-fetch.js";
import { claimSession } from "../lib/stripe/store.js";
import {
  REPORT_TIERS,
  tierPriceUsd,
  tierAmountCents,
  checkoutMetadata,
  HUMAN_REPORT_PRICE_USD,
  HUMAN_REPORT_AMOUNT_CENTS,
  HUMAN_REPORT_NAME,
} from "../lib/stripe/client.js";

// --- checkout target validation (mirrors app/api/checkout/route.js) ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

test("checkout rejects invalid/private/credential URLs via safe-fetch", () => {
  const blocked = [
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost/",
    "ftp://example.com/",
    "http://user:pass@example.com/",
    "not a url",
  ];
  for (const url of blocked) {
    assert.throws(() => validateTarget(url), AuditError, `should reject ${url}`);
  }
});

test("checkout accepts a normal public URL", () => {
  assert.equal(validateTarget("https://example.com").href, "https://example.com/");
  assert.equal(validateTarget("example.com").protocol, "https:");
});

test("checkout email validation", () => {
  for (const ok of ["a@b.co", "user.name+tag@company.io"]) assert.ok(EMAIL_RE.test(ok), ok);
  for (const bad of ["", "no-at", "a@b", "a b@c.com", "@x.com"]) assert.ok(!EMAIL_RE.test(bad), bad);
});

// --- webhook idempotency (in-memory store fallback; no DATABASE_URL in tests) ---
test("claimSession is idempotent per session id", async () => {
  assert.equal(process.env.DATABASE_URL, undefined, "test must use the in-memory fallback");
  const sid = "cs_test_" + Math.random().toString(36).slice(2);
  const first = await claimSession({ sessionId: sid, targetUrl: "https://example.com", email: "a@b.co" });
  const second = await claimSession({ sessionId: sid, targetUrl: "https://example.com", email: "a@b.co" });
  const third = await claimSession({ sessionId: sid, targetUrl: "https://example.com", email: "a@b.co" });
  assert.equal(first, true, "first delivery claims the session");
  assert.equal(second, false, "replay does not re-claim");
  assert.equal(third, false, "further replays do not re-claim");
});

test("distinct sessions each claim once", async () => {
  const a = await claimSession({ sessionId: "cs_a_" + Date.now(), targetUrl: "https://a.com", email: "a@b.co" });
  const b = await claimSession({ sessionId: "cs_b_" + Date.now(), targetUrl: "https://b.com", email: "a@b.co" });
  assert.equal(a, true);
  assert.equal(b, true);
});

// --- tiered pricing (lib/stripe/client.js; the route 400s on what these reject) ---
test("report tiers default to $9 quick / $29 deep", () => {
  assert.equal(tierPriceUsd("quick"), 9);
  assert.equal(tierPriceUsd("deep"), 29);
  assert.equal(tierAmountCents("quick"), 900);
  assert.equal(tierAmountCents("deep"), 2900);
});

test("unknown tier is rejected (checkout route turns this into a 400)", () => {
  for (const bad of ["platinum", "QUICK", "", "deep "]) {
    assert.equal(REPORT_TIERS[bad], undefined, bad);
    assert.equal(tierPriceUsd(bad), null, bad);
    assert.equal(tierAmountCents(bad), null, bad);
  }
});

test("checkout metadata carries the purchased tier", () => {
  const deep = checkoutMetadata({ targetUrl: "https://example.com/", tier: "deep" });
  assert.equal(deep.tier, "deep");
  assert.equal(deep.target_url, "https://example.com/");
  assert.equal(deep.product, "agent_readiness_report");

  const quick = checkoutMetadata({ targetUrl: "https://example.com/", tier: "quick" });
  assert.equal(quick.tier, "quick");
});

test("backward-compat constants still describe the quick tier", () => {
  assert.equal(HUMAN_REPORT_PRICE_USD, 9);
  assert.equal(HUMAN_REPORT_AMOUNT_CENTS, 900);
  assert.equal(HUMAN_REPORT_NAME, REPORT_TIERS.quick.name);
});

test("env dollar overrides parse to cents and fall back when invalid", () => {
  const prevQuick = process.env.HUMAN_QUICK_PRICE_USD;
  const prevDeep = process.env.HUMAN_DEEP_PRICE_USD;
  try {
    process.env.HUMAN_DEEP_PRICE_USD = "35";
    assert.equal(tierAmountCents("deep"), 3500);

    process.env.HUMAN_QUICK_PRICE_USD = "12.50";
    assert.equal(tierAmountCents("quick"), 1250);

    // Zero, negative, and non-numeric values fall back to the baked-in amount.
    for (const bad of ["0", "-5", "abc", ""]) {
      process.env.HUMAN_DEEP_PRICE_USD = bad;
      assert.equal(tierAmountCents("deep"), 2900, bad);
    }
  } finally {
    if (prevQuick === undefined) delete process.env.HUMAN_QUICK_PRICE_USD;
    else process.env.HUMAN_QUICK_PRICE_USD = prevQuick;
    if (prevDeep === undefined) delete process.env.HUMAN_DEEP_PRICE_USD;
    else process.env.HUMAN_DEEP_PRICE_USD = prevDeep;
  }
  assert.equal(tierAmountCents("deep"), 2900, "env restored");
});
