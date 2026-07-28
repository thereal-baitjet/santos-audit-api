// Regression tests for price-to-route attribution.
//
// Both cases below are taken verbatim from a live Agent Readiness run against
// santosautomation.com on 2026-07-28, which reported three HIGH findings that
// were all false positives produced by the extractor rather than real defects
// in the audited site.
import test from "node:test";
import assert from "node:assert/strict";
import { extractTextPricingClaims, assessPricing } from "../lib/agent-readiness/pricing.js";

const SOURCE_URL = "https://www.santosautomation.com/llms.txt";

// The two catalog lines that caused the cross-binding, unchanged.
const CATALOG = `## API — audit modes

- [Quick Intelligence Audit](https://api.santosautomation.com/api/audit?url=https%3A%2F%2Fexample.com): $0.015 USDC, synchronous (seconds), fetch-and-parse engine
- [Batch Quick Intelligence Audit](https://api.santosautomation.com/api/audit/batch): $0.50 USDC flat per batch, synchronous — POST {"urls": ["https://example.com", ...]} with up to 50 URLs ($0.01/URL at full capacity); settles only when at least one audit succeeds
`;

const claimsFor = (text, url = SOURCE_URL) => extractTextPricingClaims(text, "llms_txt", url);
const amountFor = (claims, path) =>
  claims.filter((claim) => claim.resource_url?.includes(path) && claim.amount).map((claim) => claim.amount);

test("a price binds to the route on its own line, not the previous one", () => {
  const claims = claimsFor(CATALOG);

  // /api/audit is a prefix of /api/audit/batch, and the batch price sits within
  // the old 220-char context window of the quick-audit line.
  const quick = claims.find((claim) => claim.resource_url?.endsWith("/api/audit") || claim.resource_url?.includes("/api/audit?"));
  assert.ok(quick, "expected a claim bound to /api/audit");
  assert.equal(quick.amount, "0.015");

  const batch = claims.find((claim) => claim.resource_url?.includes("/api/audit/batch"));
  assert.ok(batch, "expected a claim bound to /api/audit/batch");
  assert.equal(batch.amount, "0.5");

  // The specific regression: $0.50 must never be attributed to /api/audit.
  assert.ok(
    !amountFor(claims, "/api/audit?").includes("0.5"),
    "the batch price leaked onto the quick audit route"
  );
});

test("an illustrative parenthetical rate is not a competing price claim", () => {
  const claims = claimsFor(CATALOG);
  const batchAmounts = amountFor(claims, "/api/audit/batch");

  // "$0.50 USDC flat per batch (… $0.01/URL at full capacity)" states one price.
  assert.ok(batchAmounts.includes("0.5"), "expected the flat batch price");
  assert.ok(
    !batchAmounts.includes("0.01"),
    "the per-URL illustration was recorded as the batch price"
  );
});

test("these two lines alone produce no pricing contradiction", () => {
  const claims = claimsFor(CATALOG);
  const assessment = assessPricing({ claims });
  const amounts = assessment.contradictions.filter((item) => item.field === "amount");
  assert.deepEqual(
    amounts,
    [],
    `expected no amount contradictions, got ${JSON.stringify(amounts.map((c) => c.scope))}`
  );
});

test("a genuine contradiction is still reported", () => {
  // Same route, two different documented prices — the extractor must not go so
  // quiet that it stops catching the thing it exists to catch.
  const claims = claimsFor(
    `- [Widget](https://api.example.com/v1/widget): $0.010 USDC per call\n` +
    `- [Widget](https://api.example.com/v1/widget): $0.990 USDC per call\n`,
    "https://api.example.com/llms.txt"
  );
  const assessment = assessPricing({ claims });
  assert.ok(
    assessment.contradictions.some((item) => item.field === "amount"),
    "a real same-route price disagreement was missed"
  );
});

test("a price stated before its route still binds", () => {
  const claims = claimsFor(
    `Pay $0.25 USDC per call at https://api.example.com/v1/thing\n`,
    "https://api.example.com/llms.txt"
  );
  const bound = claims.find((claim) => claim.amount === "0.25");
  assert.ok(bound, "expected a claim for the stated price");
  assert.match(bound.resource_url ?? "", /\/v1\/thing$/);
});

test("a price with no nearby route stays unbound", () => {
  // Better to record no scope than to invent one from an unrelated URL.
  const filler = "lorem ipsum ".repeat(60); // pushes the URL past the binding window
  const claims = claimsFor(
    `https://api.example.com/v1/unrelated\n${filler}\nOur plans start at $12 USD per month.\n`,
    "https://api.example.com/llms.txt"
  );
  const priced = claims.find((claim) => claim.amount === "12");
  assert.ok(priced, "expected a claim for the stated price");
  // compactClaim drops empty fields, so an unbound price has no resource_url.
  assert.ok(!priced.resource_url, "an out-of-range URL was bound to the price");
});
