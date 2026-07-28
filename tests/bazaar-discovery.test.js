// Guards x402 Bazaar discoverability: every paid endpoint must advertise its
// own stable, canonical resource identity, or it silently fails to appear as a
// distinct product in the CDP Bazaar / Agentic Market catalog.
//
// Two suites:
//   1. Static — always runs, no network. Checks the catalog's invariants and
//      that every route file actually pins its canonical resource.
//   2. Live — runs only when BAZAAR_VERIFY_BASE_URL is set, so `npm test` stays
//      hermetic. Sends an unpaid but valid request to all eleven routes and
//      asserts the 402 challenge advertises the right identity.
//      e.g. BAZAAR_VERIFY_BASE_URL=https://api.santosautomation.com \
//             node --test tests/bazaar-discovery.test.js

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BAZAAR_ROUTES,
  BAZAAR_ICON_URL,
  BAZAAR_SERVICE_NAME,
  MAX_BAZAAR_TAGS,
  RESOURCE_BASE_URL,
  bazaarResourceMeta,
  resourceUrl,
} from "../lib/bazaar-catalog.js";

// The eleven canonical resource URLs. Anything that changes this list changes
// what the marketplace indexes, so it is pinned literally rather than derived.
const CANONICAL_RESOURCE_URLS = [
  "https://api.santosautomation.com/v1/fetch",
  "https://api.santosautomation.com/v1/extract",
  "https://api.santosautomation.com/v1/screenshot",
  "https://api.santosautomation.com/api/audit",
  "https://api.santosautomation.com/api/audit/batch",
  "https://api.santosautomation.com/api/agent-readiness",
  "https://api.santosautomation.com/v1/extract/structured",
  "https://api.santosautomation.com/v1/feed",
  "https://api.santosautomation.com/v1/links",
  "https://api.santosautomation.com/v1/summarize",
  "https://api.santosautomation.com/v1/audits",
];

// Route id -> source file, so the static suite can prove each route pins its
// own catalog entry rather than inheriting a shared one.
const ROUTE_FILES = {
  "safe-fetch": "app/v1/fetch/route.js",
  extract: "app/v1/extract/route.js",
  "structured-extract": "app/v1/extract/structured/route.js",
  screenshot: "app/v1/screenshot/route.js",
  feed: "app/v1/feed/route.js",
  links: "app/v1/links/route.js",
  summarize: "app/v1/summarize/route.js",
  "deep-audit": "app/v1/audits/route.js",
  "quick-audit": "app/api/audit/route.js",
  "batch-audit": "app/api/audit/batch/route.js",
  "agent-readiness": "app/api/agent-readiness/route.js",
};

test("catalog covers exactly the eleven canonical paid resources", () => {
  assert.equal(BAZAAR_ROUTES.length, 11);
  const urls = BAZAAR_ROUTES.map((r) => resourceUrl(r.id));
  assert.deepEqual([...urls].sort(), [...CANONICAL_RESOURCE_URLS].sort());
});

test("every resource URL is unique, canonical, and query-free", () => {
  const urls = BAZAAR_ROUTES.map((r) => resourceUrl(r.id));
  // Uniqueness is the acceptance criterion: eleven endpoints, eleven resources.
  assert.equal(new Set(urls).size, 11, "resource URLs must be distinct");

  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:", `${url} must be https`);
    // A query string in resource.url makes identity vary per caller, which is
    // exactly what stopped these endpoints from indexing.
    assert.equal(parsed.search, "", `${url} must carry no query string`);
    assert.equal(parsed.hash, "", `${url} must carry no fragment`);
    assert.notEqual(parsed.pathname, "/", `${url} must not be the API root`);
  }
});

test("no route borrows another route's path", () => {
  const paths = BAZAAR_ROUTES.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  const ids = BAZAAR_ROUTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("tags are 2-5 specific ASCII values within the Bazaar cap", () => {
  for (const route of BAZAAR_ROUTES) {
    const { tags } = route;
    assert.ok(tags.length >= 2, `${route.path} needs at least 2 tags`);
    // Bazaar's sanitizeTags silently truncates past MAX_TAGS, so anything
    // beyond the cap is metadata the catalog will never see.
    assert.ok(
      tags.length <= MAX_BAZAAR_TAGS,
      `${route.path} has ${tags.length} tags, over the cap of ${MAX_BAZAAR_TAGS}`
    );
    assert.equal(new Set(tags).size, tags.length, `${route.path} has duplicate tags`);
    for (const tag of tags) {
      assert.match(tag, /^[\x20-\x7e]+$/, `${route.path} tag "${tag}" must be printable ASCII`);
      assert.ok(tag.length <= 32, `${route.path} tag "${tag}" exceeds 32 chars`);
    }
  }
});

test("resource metadata is per-route and never a shared mutable object", () => {
  const a = bazaarResourceMeta("safe-fetch");
  const b = bazaarResourceMeta("safe-fetch");
  assert.notEqual(a.tags, b.tags, "each call must return its own tags array");

  // Mutating one route's metadata must not leak into another's listing.
  a.tags.push("mutated");
  assert.ok(!bazaarResourceMeta("safe-fetch").tags.includes("mutated"));

  const seen = new Set();
  for (const route of BAZAAR_ROUTES) {
    const meta = bazaarResourceMeta(route.id);
    assert.equal(meta.serviceName, BAZAAR_SERVICE_NAME);
    assert.equal(meta.iconUrl, BAZAAR_ICON_URL);
    assert.ok(!seen.has(meta.resource), `${route.path} reuses resource ${meta.resource}`);
    seen.add(meta.resource);
  }
});

test("each route file pins its own catalog entry", () => {
  for (const route of BAZAAR_ROUTES) {
    const file = ROUTE_FILES[route.id];
    assert.ok(file, `no source file mapped for ${route.id}`);
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf-8");

    assert.match(src, /from "(?:\.\.\/)+lib\/bazaar-catalog\.js"/, `${file} must import the catalog`);
    assert.ok(
      src.includes(`bazaarResourceMeta("${route.id}")`),
      `${file} must pin bazaarResourceMeta("${route.id}")`
    );
    // The verbless route key must match the path the resource URL is built from,
    // or the paywall and the catalog identity drift apart.
    assert.ok(
      src.includes(`"${route.path}":`),
      `${file} must register the verbless route key "${route.path}"`
    );
    // A stale hardcoded serviceName/tags pair means the route bypassed the catalog.
    assert.ok(!/^\s*serviceName: "/m.test(src), `${file} still hardcodes serviceName`);
  }
});

test("dual-method routes declare a request shape per verb", () => {
  for (const route of BAZAAR_ROUTES) {
    for (const method of route.methods) {
      const style = route.style[method];
      assert.ok(style, `${route.path} declares ${method} with no input style`);
      // Bazaar's own schema splits these: GET/HEAD/DELETE carry query params,
      // POST/PUT/PATCH carry a body. Advertising the wrong one yields a
      // descriptor the marketplace cannot replay.
      const expected = method === "GET" ? "query" : "body";
      assert.equal(style, expected, `${route.path} ${method} should use ${expected} style`);
    }
  }
});

// ---------------------------------------------------------------------------
// Live suite — opt in with BAZAAR_VERIFY_BASE_URL.
// ---------------------------------------------------------------------------

const LIVE_BASE = process.env.BAZAAR_VERIFY_BASE_URL?.replace(/\/+$/, "");

test("live: every paid route 402s with its own canonical Bazaar resource", { skip: !LIVE_BASE }, async (t) => {
  const seen = new Map();

  for (const route of BAZAAR_ROUTES) {
    await t.test(`${route.probe.method} ${route.path}`, async () => {
      const url = new URL(`${LIVE_BASE}${route.path}`);
      if (route.probe.query) {
        for (const [k, v] of Object.entries(route.probe.query)) url.searchParams.set(k, v);
      }
      const init = { method: route.probe.method, headers: {} };
      if (route.probe.body) {
        init.headers["content-type"] = "application/json";
        init.body = JSON.stringify(route.probe.body);
      }

      const res = await fetch(url, init);
      assert.equal(res.status, 402, "an unpaid but valid request must be challenged");

      const header = res.headers.get("PAYMENT-REQUIRED");
      assert.ok(header, "402 must carry a PAYMENT-REQUIRED header");
      const challenge = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));

      assert.equal(
        challenge.resource?.url,
        resourceUrl(route.id),
        "resource.url must equal this route's canonical URL"
      );
      assert.equal(challenge.resource?.serviceName, BAZAAR_SERVICE_NAME);
      assert.ok(challenge.resource?.iconUrl, "resource.iconUrl must be set");

      const bazaar = challenge.extensions?.bazaar;
      assert.ok(bazaar, "extensions.bazaar must be present");
      assert.equal(
        bazaar.info?.input?.method,
        route.probe.method,
        "bazaar input method must match the request method"
      );

      const shape = bazaar.info?.input?.bodyType ? "body" : "query";
      assert.equal(shape, route.style[route.probe.method], "bazaar input shape must match the verb");
      assert.ok(bazaar.info?.output?.example, "bazaar must declare an output example");
      assert.ok(bazaar.schema?.properties?.output, "bazaar must declare an output schema");

      const prior = seen.get(challenge.resource.url);
      assert.equal(prior, undefined, `resource.url collides with ${prior}`);
      seen.set(challenge.resource.url, route.path);
    });
  }

  assert.equal(seen.size, 11, "the eleven routes must emit eleven distinct resource URLs");
});

test("live: resource base matches the catalog", { skip: !LIVE_BASE }, () => {
  // A preview deploy advertising production URLs (or vice versa) would pollute
  // the catalog, so make the mismatch loud rather than silent.
  if (LIVE_BASE !== RESOURCE_BASE_URL) {
    console.warn(
      `[warn] probing ${LIVE_BASE} but the catalog advertises ${RESOURCE_BASE_URL}; ` +
        "set X402_RESOURCE_BASE_URL on that deploy if this is intentional"
    );
  }
});
