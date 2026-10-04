import test from "node:test";
import assert from "node:assert/strict";
import { AuditCache } from "../lib/audit-cache.js";

function createCache(t, backend = "memory", ttlMs = 60_000) {
  const cache = new AuditCache(ttlMs);
  // Never connect to an environment's real Redis instance from unit tests.
  cache.redisUrl = backend === "redis" ? "redis://fixture.invalid" : null;
  const redisEntries = new Map();
  const redisWrites = [];
  if (backend === "redis") {
    cache.redis = {
      get: async (key) => redisEntries.get(key) ?? null,
      setEx: async (key, ttl, value) => {
        redisWrites.push({ key, ttl });
        redisEntries.set(key, value);
      },
      flushDb: async () => redisEntries.clear(),
    };
  }
  t.after(() => cache.clear());
  return { cache, redisEntries, redisWrites };
}

for (const backend of ["memory", "redis"]) {
  test(`${backend}: different query values cannot return or overwrite another report`, async (t) => {
    const { cache } = createCache(t, backend);
    const firstUrl = "https://example.com/search?q=first";
    const secondUrl = "https://example.com/search?q=second";
    const first = { url: firstUrl, overall_score: 11 };
    const second = { url: secondUrl, overall_score: 99 };

    await cache.set(firstUrl, first);
    assert.equal(await cache.get(secondUrl), null);
    await cache.set(secondUrl, second);
    assert.deepEqual(await cache.get(firstUrl), first);
    assert.deepEqual(await cache.get(secondUrl), second);
    assert.deepEqual(cache.stats(), { backend, hits: 2, misses: 1, hitRate: "66.7%" });
  });

  test(`${backend}: absent, empty, and populated query strings stay distinct`, async (t) => {
    const { cache } = createCache(t, backend);
    const urls = [
      "https://example.com/search",
      "https://example.com/search?",
      "https://example.com/search?q",
      "https://example.com/search?q=",
      "https://example.com/search?q=value",
    ];
    for (const url of urls) {
      assert.equal(await cache.get(url), null, `${url} must not reuse an earlier variant`);
      await cache.set(url, { url });
    }
    for (const url of urls) assert.deepEqual(await cache.get(url), { url });
  });

  test(`${backend}: query order, repeated parameters, and encoding are not rewritten`, async (t) => {
    const { cache } = createCache(t, backend);
    const queries = [
      "a=1&b=2", "b=2&a=1",
      "q=first&q=second", "q=second&q=first",
      "q=a+b", "q=a%20b", "q=a%2Bb",
      "q=%2f", "q=%2F",
    ];
    for (const query of queries) {
      const url = `https://example.com/search?${query}`;
      assert.equal(await cache.get(url), null);
      await cache.set(url, { query });
    }
    for (const query of queries) {
      assert.deepEqual(await cache.get(`https://example.com/search?${query}`), { query });
    }
  });

  test(`${backend}: URL normalization and fragment-insensitive hits are preserved`, async (t) => {
    const { cache } = createCache(t, backend);
    const report = { overall_score: 42 };
    await cache.set("HTTPS://EXAMPLE.COM:443/search?q=value#first", report);
    assert.deepEqual(await cache.get("https://example.com/search?q=value#second"), report);
    assert.deepEqual(await cache.get("https://example.com/search?q=value"), report);

    await cache.set("https://example.com", report);
    assert.deepEqual(await cache.get("https://example.com/"), report);
    await cache.set("https://example.com/search", report);
    assert.equal(await cache.get("https://example.com/search/"), null);
    assert.equal(await cache.get("https://example.com/Search"), null);
    assert.equal(await cache.get("http://example.com/search"), null);
    assert.equal(await cache.get("https://example.com:8443/search"), null);
    assert.equal(await cache.get("https://other.example/search"), null);
  });

  test(`${backend}: legacy query-collapsed entries are never reused`, async (t) => {
    const { cache, redisEntries } = createCache(t, backend);
    const legacyKey = "audit:https://example.com/search";
    const wrongReport = { url: "https://example.com/search?q=old" };
    cache.cache.set(legacyKey, { report: wrongReport, expiresAt: Date.now() + 60_000 });
    redisEntries.set(legacyKey, JSON.stringify(wrongReport));

    assert.equal(await cache.get("https://example.com/search"), null);
    assert.equal(await cache.get("https://example.com/search?q=old"), null);
    assert.equal(await cache.get("https://example.com/search?q=new"), null);
  });

  test(`${backend}: unparsable inputs retain exact fallback keys`, async (t) => {
    const { cache } = createCache(t, backend);
    const report = { overall_score: 42 };
    await cache.set("example.com/search?q=first", report);
    assert.deepEqual(await cache.get("example.com/search?q=first"), report);
    assert.equal(await cache.get("example.com/search?q=second"), null);
  });
}

test("memory: a query-specific entry expires without evicting another query", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const { cache } = createCache(t);
  await cache.set("https://example.com/?q=first", { value: 1 }, 1000);
  await cache.set("https://example.com/?q=second", { value: 2 }, 2000);
  t.mock.timers.tick(1001);
  assert.equal(await cache.get("https://example.com/?q=first"), null);
  assert.deepEqual(await cache.get("https://example.com/?q=second"), { value: 2 });
  t.mock.timers.tick(1000);
  assert.equal(await cache.get("https://example.com/?q=second"), null);
});

test("memory: replacing the same URL refreshes its report and expiry", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  const { cache } = createCache(t);
  const url = "https://example.com/?q=first";
  await cache.set(url, { value: 1 }, 1000);
  t.mock.timers.tick(500);
  await cache.set(url, { value: 2 }, 2000);
  t.mock.timers.tick(501);
  assert.deepEqual(await cache.get(url), { value: 2 });
  t.mock.timers.tick(1500);
  assert.equal(await cache.get(url), null);
});

test("redis: default and per-write TTLs still round up to whole seconds", async (t) => {
  const { cache, redisWrites } = createCache(t, "redis", 1001);
  await cache.set("https://example.com/?q=first", { value: 1 });
  await cache.set("https://example.com/?q=second", { value: 2 }, 3001);
  assert.deepEqual(redisWrites.map(({ ttl }) => ttl), [2, 4]);
  assert.notEqual(redisWrites[0].key, redisWrites[1].key);
});
