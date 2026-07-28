// The free tier's quota identity.
//
// IP is the wrong identity for a hosted agent: Grok and any similar platform
// call this server from a small set of shared egress addresses, so an IP-keyed
// quota is one free call per day for that platform's entire user base — no
// matter how high the limit is set. A verified-email token moves the quota onto
// the individual user. These tests pin that behaviour, and pin that an invalid
// token can never fall back to the IP allowance.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveFreeQuota, dailyEmailKey, hashIdentity } from "../lib/demo-limit.js";

const today = () => new Date().toISOString().slice(0, 10);

test("no token falls back to the caller IP", async () => {
  const { key, identity } = await resolveFreeQuota({ ip: "203.0.113.9" });
  assert.equal(identity, "ip");
  assert.equal(key, `demo:${today()}:${hashIdentity("203.0.113.9")}`);
});

test("blank and whitespace tokens are treated as absent, not invalid", async () => {
  for (const token of ["", "   ", undefined, null]) {
    const { key, identity } = await resolveFreeQuota({ token, ip: "203.0.113.9" });
    assert.equal(identity, "ip", `token ${JSON.stringify(token)} should fall back to IP`);
    assert.ok(key);
  }
});

test("an unverifiable token is rejected outright", async () => {
  // Critical: it must NOT fall back to the IP key. Falling back would make a
  // junk token a way to keep calling after that IP's allowance is spent.
  const { key, identity } = await resolveFreeQuota({ token: "not-a-real-token", ip: "203.0.113.9" });
  assert.equal(identity, "invalid_token");
  assert.equal(key, null);
});

test("two callers behind one IP share a key; two tokens do not", async () => {
  const a = await resolveFreeQuota({ ip: "198.51.100.7" });
  const b = await resolveFreeQuota({ ip: "198.51.100.7" });
  assert.equal(a.key, b.key, "same IP must share one allowance");

  // Distinct verified emails must land on distinct keys. dailyEmailKey is the
  // function resolveFreeQuota uses once a token verifies.
  assert.notEqual(
    dailyEmailKey("one@example.com"),
    dailyEmailKey("two@example.com"),
    "two verified users must not share an allowance"
  );
});

test("email keys are namespaced away from IP keys", async () => {
  // An email whose hash collided with an IP hash must not spend that IP's
  // allowance, so the two key spaces carry different prefixes.
  const ipKey = (await resolveFreeQuota({ ip: "203.0.113.9" })).key;
  const emailKey = dailyEmailKey("someone@example.com");
  assert.ok(emailKey.includes(":email:"), "email keys must be namespaced");
  assert.ok(!ipKey.includes(":email:"), "IP keys must not use the email namespace");
});

test("raw identities never appear in a storage key", async () => {
  const ip = "203.0.113.9";
  const email = "someone@example.com";
  const ipKey = (await resolveFreeQuota({ ip })).key;
  assert.ok(!ipKey.includes(ip), "the raw IP leaked into the key");
  assert.ok(!dailyEmailKey(email).includes(email), "the raw email leaked into the key");
});
