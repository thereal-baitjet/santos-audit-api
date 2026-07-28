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

// ---------------------------------------------------------------------------
// The HTTP demo gate. Same identity rules as the MCP tools, so a caller who
// runs out is told the same actionable next step everywhere.
// ---------------------------------------------------------------------------

import { openDemoQuota, FREE_TIER_HELP, INVALID_TOKEN_HELP } from "../lib/demo-limit.js";

const request = (token) => ({
  nextUrl: { searchParams: new URLSearchParams(token ? { token } : {}) },
  headers: new Headers({ "x-forwarded-for": "203.0.113.55" }),
});

test("the demo gate rejects a token that does not verify", async () => {
  const gate = await openDemoQuota(request("nope-not-a-token"));
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "invalid_token");
  assert.ok(!gate.claim, "a rejected gate must expose no claim");
});

test("the demo gate falls back to the IP when no token is supplied", async () => {
  const gate = await openDemoQuota(request());
  // Either it opened on the IP allowance or that IP is already spent — both are
  // IP-identified outcomes, never an invalid-token rejection.
  assert.notEqual(gate.reason, "invalid_token");
  if (gate.ok) {
    assert.equal(gate.identity, "ip");
    assert.equal(typeof gate.claim, "function");
  } else {
    assert.equal(gate.reason, "rate_limited");
  }
});

test("free-tier help names the free path before the paid one", async () => {
  // The whole point of the funnel fix: a caller who runs out must be offered the
  // step that costs them nothing and identifies them, not just a checkout link.
  const freeAt = FREE_TIER_HELP.indexOf("/free-token");
  const paidAt = FREE_TIER_HELP.indexOf("/agent-readiness/buy");
  assert.ok(freeAt !== -1, "help text must link the token page");
  assert.ok(paidAt !== -1, "help text must still offer the paid path");
  assert.ok(freeAt < paidAt, "the free path must come first");
  assert.ok(INVALID_TOKEN_HELP.includes("/free-token"), "invalid-token help must link the token page");
});

// ---------------------------------------------------------------------------
// MCP Registry namespace resolution. The registry namespaces servers by reverse
// DNS and its search does not match dotted hostnames — searching
// "santosautomation.com" returns nothing while "com.santosautomation" returns
// the entry, so getting this transform wrong silently reports every published
// server as unlisted.
// ---------------------------------------------------------------------------

import { registryNamespaceFor } from "../lib/agent-readiness/analyze.js";

test("hostnames map to their reverse-DNS registry namespace", () => {
  assert.equal(registryNamespaceFor("santosautomation.com"), "com.santosautomation");
  assert.equal(registryNamespaceFor("www.santosautomation.com"), "com.santosautomation");
  assert.equal(registryNamespaceFor("WWW.SantosAutomation.COM"), "com.santosautomation");
  assert.equal(registryNamespaceFor("api.example.co.uk"), "uk.co.example.api");
  assert.equal(registryNamespaceFor("example.com."), "com.example");
});

test("unresolvable hostnames yield no namespace rather than a bad search", () => {
  for (const bad of ["", "   ", "localhost", null, undefined]) {
    assert.equal(registryNamespaceFor(bad), null, `${JSON.stringify(bad)} should not produce a namespace`);
  }
});
