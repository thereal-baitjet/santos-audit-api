// The limiter's behaviour when its durable store is unreachable.
//
// It used to fail fully open: an outage meant unlimited free audits on a
// public, browser-capable service — the worst moment to be ungoverned, since
// the same outage removes the ability to measure the abuse. These tests pin the
// bounded replacement.
import test from "node:test";
import assert from "node:assert/strict";

// Force the Postgres adapter and point it at a closed port so every store call
// fails, which is what an outage looks like from inside the limiter.
process.env.DATABASE_URL = "postgresql://unreachable@127.0.0.1:1/none";
delete process.env.RATE_LIMIT_STORE_URL;
delete process.env.RATE_LIMIT_STORE_TOKEN;
process.env.FREE_TIER_EMERGENCY_MAX = "2";
delete process.env.DISCORD_WEBHOOK_URL; // no real alert from tests

const { peekKey, claimKey, limiterStatus, resetLimiterStatus, openDemoQuota } =
  await import("../lib/demo-limit.js");

const KEY = () => `test:degraded:${Math.random().toString(36).slice(2)}`;

test("an outage grants a small allowance, then denies", async () => {
  resetLimiterStatus();
  const key = KEY();
  // EMERGENCY_MAX = 2, so exactly two grants then refusal.
  assert.equal(await claimKey(key, 60), true, "first emergency grant");
  assert.equal(await claimKey(key, 60), true, "second emergency grant");
  assert.equal(await claimKey(key, 60), false, "third must be denied, not fail open");
});

test("peek reports no room once the allowance is spent", async () => {
  resetLimiterStatus();
  const key = KEY();
  assert.equal(await peekKey(key), true, "room before any grant");
  await claimKey(key, 60);
  await claimKey(key, 60);
  assert.equal(await peekKey(key), false, "no room after the cap");
});

test("an outage is recorded so operators and callers can see it", async () => {
  resetLimiterStatus();
  assert.equal(limiterStatus().degraded, false, "clean before any failure");
  await claimKey(KEY(), 60);
  const status = limiterStatus();
  assert.equal(status.degraded, true);
  assert.ok(status.since, "records when degradation started");
  assert.ok(status.reason, "records why");
  assert.equal(status.emergencyMax, 2);
});

test("the allowance is per key, so one abuser cannot spend everyone's", async () => {
  resetLimiterStatus();
  const a = KEY(), b = KEY();
  await claimKey(a, 60);
  await claimKey(a, 60);
  assert.equal(await claimKey(a, 60), false, "first key exhausted");
  assert.equal(await claimKey(b, 60), true, "a different key still has its own allowance");
});

test("heavy LLM-backed work is refused outright while degraded", async () => {
  resetLimiterStatus();
  await claimKey(KEY(), 60); // trip degraded mode
  const req = { nextUrl: { searchParams: new URLSearchParams() }, headers: new Headers({ "x-forwarded-for": "203.0.113.10" }) };
  const gate = await openDemoQuota(req, { heavy: true });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "degraded", "spending LLM tokens must not ride the emergency allowance");
});
