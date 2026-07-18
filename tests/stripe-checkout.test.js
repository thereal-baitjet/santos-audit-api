// Input-validation tests for the Stripe checkout + webhook paths. These run
// without network/Stripe: they exercise the pure validation and idempotency
// logic, so `npm test` never touches real payments.
import test from "node:test";
import assert from "node:assert/strict";

import { validateTarget, AuditError } from "../lib/safe-fetch.js";
import { claimSession } from "../lib/stripe/store.js";

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
