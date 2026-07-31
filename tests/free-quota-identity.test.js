// The free tier's quota identity.
//
// The free tier is now a single surface: the MCP tool audit_website_preview,
// one call per day per calling IP. The verified-email token that used to move
// the quota onto an individual user is gone with the rest of the free tier, so
// IP is the only identity — and these tests pin what that means, including the
// honest limitation that a hosted agent's whole user base shares one address.
import test from "node:test";
import assert from "node:assert/strict";
import { openPreviewQuota, hasFreeAudit, markFreeAudit, claimSlot, hashIdentity, FREE_TIER_HELP } from "../lib/demo-limit.js";

const ip = () => `203.0.113.${Math.floor(Math.random() * 200) + 20}`;

test("the preview is one call per day per IP", async () => {
  const caller = ip();
  const first = await openPreviewQuota(caller);
  assert.equal(first.ok, true, "a fresh IP gets the day's call");
  assert.equal(typeof first.claim, "function");

  assert.equal(await first.claim(), true, "claiming after success must win");

  const second = await openPreviewQuota(caller);
  assert.equal(second.ok, false, "the same IP is refused for the rest of the day");
  assert.ok(!second.claim, "a refused gate must expose no claim");
});

test("the claim happens after the work, so a failure never burns the day", async () => {
  const caller = ip();
  const gate = await openPreviewQuota(caller);
  assert.equal(gate.ok, true);
  // Caller errors out and never calls claim().
  assert.equal(await hasFreeAudit(caller), true, "an unclaimed allowance is still available");
});

test("two IPs do not share an allowance", async () => {
  const a = ip(), b = ip();
  await markFreeAudit(a);
  assert.equal(await hasFreeAudit(a), false, "a is spent");
  assert.equal(await hasFreeAudit(b), true, "b is untouched");
});

test("raw identities never appear in a storage key", () => {
  const raw = "203.0.113.9";
  const hashed = hashIdentity(raw);
  assert.ok(!hashed.includes(raw), "the raw IP leaked into the key");
  assert.match(hashed, /^[0-9a-f]{32}$/, "keys are a hex HMAC prefix");
  assert.equal(hashIdentity(raw), hashed, "hashing is stable, or quotas would reset every call");
  assert.notEqual(hashIdentity("203.0.113.10"), hashed, "distinct IPs must not collide");
});

test("a fixed window allows exactly N claims, then refuses", async () => {
  const prefix = `test:slot:${Math.random().toString(36).slice(2)}:`;
  for (let i = 1; i <= 3; i++) {
    assert.equal(await claimSlot(prefix, 3, 60), true, `claim ${i} of 3 must be granted`);
  }
  assert.equal(await claimSlot(prefix, 3, 60), false, "the window is full");
});

test("free-tier help offers a real next step and no retired one", async () => {
  // The token page and the whole verified-email flow are gone; pointing a
  // stranded caller at a 404 is worse than saying nothing.
  assert.ok(!FREE_TIER_HELP.includes("/free-token"), "must not link the retired token page");
  assert.ok(FREE_TIER_HELP.includes("/agent-readiness/buy"), "must offer the card path");
  assert.ok(/x402/i.test(FREE_TIER_HELP), "must offer the machine-payable path");
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
