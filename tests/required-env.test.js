// Production secret validation.
//
// This repository is public, so a "dev-only-…" fallback surviving into
// production means the secret signing report HMACs, access tokens, and
// monitoring manage links is readable on GitHub. These tests pin that
// production fails closed while local development keeps its conveniences.
import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_PRODUCTION_SECRETS,
  checkProductionSecrets,
  assertProductionSecrets,
  isProductionEnv,
} from "../lib/required-env.js";

const complete = {
  REPORT_ACCESS_TOKEN_SECRET: "real-token-secret",
  IDEMPOTENCY_HASH_SECRET: "real-idem-secret",
  RATE_LIMIT_HASH_SECRET: "real-hash-secret",
};

test("a production deploy missing a secret is rejected", () => {
  const env = { VERCEL_ENV: "production", ...complete };
  delete env.REPORT_ACCESS_TOKEN_SECRET;
  assert.throws(() => assertProductionSecrets(env), /REPORT_ACCESS_TOKEN_SECRET: missing/);
});

test("every problem is reported at once, not one per attempt", () => {
  const { ok, problems } = checkProductionSecrets({ VERCEL_ENV: "production" });
  assert.equal(ok, false);
  assert.equal(problems.length, REQUIRED_PRODUCTION_SECRETS.length, "all missing secrets reported together");
});

test("a published dev placeholder is treated as missing, not as a value", () => {
  // The exact failure this exists to prevent: the secret is *set*, but to a
  // value anyone can read in this repository.
  const env = { VERCEL_ENV: "production", ...complete, RATE_LIMIT_HASH_SECRET: "santos-demo-limit" };
  assert.throws(() => assertProductionSecrets(env), /RATE_LIMIT_HASH_SECRET: set to a published dev placeholder/);
});

test("a fully configured production deploy passes and reports enforcement", () => {
  const result = assertProductionSecrets({ VERCEL_ENV: "production", ...complete });
  assert.equal(result.ok, true);
  assert.equal(result.enforced, true);
});

test("local and preview keep their dev fallbacks", () => {
  for (const env of [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }]) {
    assert.equal(isProductionEnv(env), false, `${JSON.stringify(env)} must not enforce`);
    const result = assertProductionSecrets(env);
    assert.equal(result.ok, true);
    assert.equal(result.enforced, false, "skipped rather than passed");
  }
});

test("enforcement can be simulated locally without pretending to be Vercel", () => {
  assert.equal(isProductionEnv({ SANTOS_REQUIRE_SECRETS: "true" }), true);
  assert.throws(() => assertProductionSecrets({ SANTOS_REQUIRE_SECRETS: "true" }), /Refusing to build/);
});

test("every declared secret explains why it matters", () => {
  // The error message is the whole value of this gate at 3am.
  for (const secret of REQUIRED_PRODUCTION_SECRETS) {
    assert.ok(secret.name, "has a name");
    assert.ok(secret.why && secret.why.length > 40, `${secret.name} needs a real explanation`);
    assert.ok(secret.devFallback, `${secret.name} declares the placeholder to reject`);
  }
});
