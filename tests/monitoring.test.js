// Tests for the Santos Monitoring subscription (weekly re-audit). These run
// without network/Stripe: they exercise the pure alert/digest decision logic,
// the HMAC manage-token round-trip, and the checkout session params builder,
// so `npm test` never touches real payments.
import test from "node:test";
import assert from "node:assert/strict";

import { decideMonitoringAction, topIssuesFromReport, ALERT_THRESHOLD, DIGEST_INTERVAL_DAYS } from "../lib/monitoring/decide.js";
import { monitoringTokenFor, verifyMonitoringToken } from "../lib/monitoring/tokens.js";
import { monitoringCheckoutParams, monitoringAmountCents, MONITORING_PRODUCT_NAME } from "../lib/monitoring/checkout.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-07-27T12:00:00Z");

// --- alert/digest decision logic (lib/monitoring/decide.js) ---

test("score move >= 5 points in either direction alerts", () => {
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 65, lastDigestAt: NOW, now: NOW }), "alert");
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 55, lastDigestAt: NOW, now: NOW }), "alert");
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 90, lastDigestAt: null, now: NOW }), "alert");
});

test("score move < 5 points does not alert", () => {
  assert.notEqual(decideMonitoringAction({ lastScore: 60, newScore: 64, lastDigestAt: null, now: NOW }), "alert");
  assert.notEqual(decideMonitoringAction({ lastScore: 60, newScore: 56, lastDigestAt: null, now: NOW }), "alert");
  assert.notEqual(decideMonitoringAction({ lastScore: 60, newScore: 60, lastDigestAt: null, now: NOW }), "alert");
});

test("stable score digests when last digest is >= 28 days old or never sent", () => {
  const old = new Date(NOW.getTime() - DIGEST_INTERVAL_DAYS * DAY_MS);
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 62, lastDigestAt: null, now: NOW }), "digest");
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 62, lastDigestAt: old, now: NOW }), "digest");
  const older = new Date(NOW.getTime() - 60 * DAY_MS);
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 60, lastDigestAt: older, now: NOW }), "digest");
});

test("stable score stays quiet when a digest went out recently", () => {
  const recent = new Date(NOW.getTime() - 13 * DAY_MS);
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 62, lastDigestAt: recent, now: NOW }), "none");
  assert.equal(decideMonitoringAction({ lastScore: 60, newScore: 60, lastDigestAt: NOW, now: NOW }), "none");
});

test("no baseline score never alerts (first cron run of an old subscription)", () => {
  assert.notEqual(decideMonitoringAction({ lastScore: null, newScore: 42, lastDigestAt: NOW, now: NOW }), "alert");
  assert.equal(decideMonitoringAction({ lastScore: null, newScore: 42, lastDigestAt: NOW, now: NOW }), "none");
});

test("alert threshold and digest interval constants match the email copy", () => {
  assert.equal(ALERT_THRESHOLD, 5);
  assert.equal(DIGEST_INTERVAL_DAYS, 28);
});

test("topIssuesFromReport prefers recommended_actions and caps at 5", () => {
  const report = {
    recommended_actions: Array.from({ length: 8 }, (_, i) => ({ priority: i + 1, title: `Fix ${i + 1}` })),
  };
  assert.deepEqual(topIssuesFromReport(report), ["Fix 1", "Fix 2", "Fix 3", "Fix 4", "Fix 5"]);
  assert.deepEqual(topIssuesFromReport({ issues: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(topIssuesFromReport(null), []);
  assert.deepEqual(topIssuesFromReport({}), []);
});

// --- manage-token round-trip (lib/monitoring/tokens.js) ---

test("monitoring manage token round-trips the subscription id", () => {
  const id = "2f2f0f0e-1234-4abc-8def-0123456789ab";
  const token = monitoringTokenFor(id);
  assert.equal(verifyMonitoringToken(token), id);
});

test("tampered or malformed tokens are rejected", () => {
  const id = "2f2f0f0e-1234-4abc-8def-0123456789ab";
  const token = monitoringTokenFor(id);
  // Flip a character in the signature segment.
  const parts = token.split(".");
  parts[3] = (parts[3].endsWith("A") ? "B" : "A") + parts[3].slice(1);
  assert.equal(verifyMonitoringToken(parts.join(".")), null);
  assert.equal(verifyMonitoringToken("not-a-token"), null);
  assert.equal(verifyMonitoringToken(null), null);
  assert.equal(verifyMonitoringToken(monitoringTokenFor("other-id")), "other-id", "different ids mint different tokens");
  assert.notEqual(verifyMonitoringToken(monitoringTokenFor("other-id")), id);
});

test("expired tokens are rejected", () => {
  const past = Math.floor(Date.now() / 1000) - 60;
  assert.equal(verifyMonitoringToken(monitoringTokenFor("some-id", past)), null);
});

// --- monitoring checkout session shape (lib/monitoring/checkout.js) ---

test("monitoring checkout session is a monthly $9 subscription by default", () => {
  const prev = process.env.MONITORING_PRICE_USD;
  delete process.env.MONITORING_PRICE_USD;
  try {
    const params = monitoringCheckoutParams({
      email: "a@b.co",
      targetUrl: "https://example.com/",
      origin: "https://www.santosautomation.com",
    });
    assert.equal(params.mode, "subscription");
    assert.equal(params.customer_email, "a@b.co");
    assert.deepEqual(params.metadata, { product: "monitoring", target_url: "https://example.com/" });
    assert.equal(params.success_url, "https://www.santosautomation.com/monitoring/thanks");
    assert.equal(params.cancel_url, "https://www.santosautomation.com/monitoring?canceled=1");

    assert.equal(params.line_items.length, 1);
    const priceData = params.line_items[0].price_data;
    assert.equal(priceData.currency, "usd");
    assert.equal(priceData.unit_amount, 900);
    assert.deepEqual(priceData.recurring, { interval: "month" });
    assert.equal(priceData.product_data.name, MONITORING_PRODUCT_NAME);
    assert.equal(priceData.product_data.name, "Santos Monitoring — weekly website intelligence");
  } finally {
    if (prev === undefined) delete process.env.MONITORING_PRICE_USD;
    else process.env.MONITORING_PRICE_USD = prev;
  }
});

test("MONITORING_PRICE_USD override parses to cents and falls back when invalid", () => {
  const prev = process.env.MONITORING_PRICE_USD;
  try {
    process.env.MONITORING_PRICE_USD = "12.50";
    assert.equal(monitoringAmountCents(), 1250);

    for (const bad of ["0", "-5", "abc", ""]) {
      process.env.MONITORING_PRICE_USD = bad;
      assert.equal(monitoringAmountCents(), 900, bad);
    }
  } finally {
    if (prev === undefined) delete process.env.MONITORING_PRICE_USD;
    else process.env.MONITORING_PRICE_USD = prev;
  }
  assert.equal(monitoringAmountCents(), 900, "env restored");
});
