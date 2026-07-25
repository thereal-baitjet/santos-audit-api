// Unit tests for lib/x402-xrpl.js — XRPL exact scheme, USD->drops conversion,
// live-oracle caching/fallback, and the XRPL_PAY_TO enable guard.
// fetch is mocked throughout: no live oracle calls in tests.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  ExactXrplScheme,
  XRPL_NETWORK,
  XrplFacilitatorClient,
  _resetXrpPriceCache,
  getXrpUsdPrice,
  usdToXrpDrops,
  xrplEnabled,
} from "../lib/x402-xrpl.js";

const realFetch = globalThis.fetch;
const realFallbackEnv = process.env.XRP_USD_PRICE;

let fetchCalls;
function mockFetch(impl) {
  fetchCalls = [];
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args[0]);
    return impl(...args);
  };
}
const jsonResponse = (body) => ({ ok: true, json: async () => body });

beforeEach(() => {
  _resetXrpPriceCache();
  delete process.env.XRP_USD_PRICE;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realFallbackEnv === undefined) delete process.env.XRP_USD_PRICE;
  else process.env.XRP_USD_PRICE = realFallbackEnv;
  _resetXrpPriceCache();
});

test("disabled by default: XRPL_PAY_TO unset means the rail is off", () => {
  // The module was imported with XRPL_PAY_TO unset in the test environment.
  assert.equal(xrplEnabled(), false);
});

test("malformed XRPL_PAY_TO disables the rail with a warning", async () => {
  process.env.XRPL_PAY_TO = "0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B"; // EVM, not XRPL
  const mod = await import("../lib/x402-xrpl.js?case=bad-address");
  assert.equal(mod.xrplEnabled(), false);
  delete process.env.XRPL_PAY_TO;
});

test("valid classic XRPL address enables the rail", async () => {
  process.env.XRPL_PAY_TO = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
  const mod = await import("../lib/x402-xrpl.js?case=good-address");
  assert.equal(mod.xrplEnabled(), true);
  delete process.env.XRPL_PAY_TO;
});

test("live oracle: Coinbase spot rate drives the drops conversion", async () => {
  mockFetch(async () => jsonResponse({ data: { amount: "2.00" } }));
  // $0.015 at $2.00/XRP = 0.0075 XRP = 7500 drops.
  assert.equal(await usdToXrpDrops(0.015), "7500");
  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0]), /coinbase\.com/);
});

test("oracle result is cached: repeated conversions do not refetch", async () => {
  mockFetch(async () => jsonResponse({ data: { amount: "2.00" } }));
  await usdToXrpDrops(0.015);
  await usdToXrpDrops(0.08);
  assert.equal(fetchCalls.length, 1);
});

test("CoinGecko is used when Coinbase fails", async () => {
  mockFetch(async (url) => {
    if (String(url).includes("coinbase")) throw new Error("coinbase down");
    return jsonResponse({ ripple: { usd: 4 } });
  });
  // $0.08 at $4.00/XRP = 0.02 XRP = 20000 drops.
  assert.equal(await usdToXrpDrops(0.08), "20000");
  assert.equal(fetchCalls.length, 2);
});

test("total oracle outage falls back to XRP_USD_PRICE env", async () => {
  mockFetch(async () => {
    throw new Error("all oracles down");
  });
  process.env.XRP_USD_PRICE = "2.50";
  // $0.015 at $2.50/XRP = 0.006 XRP = 6000 drops.
  assert.equal(await usdToXrpDrops(0.015), "6000");
});

test("total oracle outage without env falls back to the built-in rate", async () => {
  mockFetch(async () => {
    throw new Error("all oracles down");
  });
  const rate = await getXrpUsdPrice();
  assert.equal(rate, 1.15);
});

test("drops conversion rounds up (ceil), never undercharging", async () => {
  mockFetch(async () => jsonResponse({ data: { amount: "1.15" } }));
  // 0.015 / 1.15 * 1e6 = 13043.478... -> 13044.
  assert.equal(await usdToXrpDrops(0.015), "13044");
});

test("parsePrice converts the same USD string routes advertise for USDC", async () => {
  mockFetch(async () => jsonResponse({ data: { amount: "2.00" } }));
  const scheme = new ExactXrplScheme();
  assert.deepEqual(await scheme.parsePrice("$0.015", XRPL_NETWORK), {
    amount: "7500",
    asset: "XRP",
  });
});

test("parsePrice passes through a pre-converted AssetAmount", async () => {
  const scheme = new ExactXrplScheme();
  assert.deepEqual(
    await scheme.parsePrice({ amount: "1234", asset: "XRP" }, XRPL_NETWORK),
    { amount: "1234", asset: "XRP" },
  );
});

test("parsePrice rejects unparseable prices and foreign networks", async () => {
  const scheme = new ExactXrplScheme();
  await assert.rejects(() => scheme.parsePrice("ten bucks", XRPL_NETWORK));
  await assert.rejects(() => scheme.parsePrice("$0.015", "eip155:8453"));
});

test("XRP uses 6 decimals (1 XRP = 1,000,000 drops), same as USDC", () => {
  assert.equal(new ExactXrplScheme().getAssetDecimals(), 6);
});

test("enhancePaymentRequirements is a passthrough that keeps terms intact", async () => {
  const scheme = new ExactXrplScheme();
  const reqs = {
    scheme: "exact",
    network: XRPL_NETWORK,
    amount: "7500",
    asset: "XRP",
    payTo: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    maxTimeoutSeconds: 300,
  };
  assert.deepEqual(await scheme.enhancePaymentRequirements(reqs), reqs);
});

test("facilitator /supported outage still advertises exact/xrpl:0 from config", async () => {
  mockFetch(async () => {
    throw new Error("t54 down");
  });
  const client = new XrplFacilitatorClient("https://facilitator.invalid");
  const supported = await client.getSupported();
  assert.deepEqual(supported.kinds, [
    { x402Version: 2, scheme: "exact", network: "xrpl:0" },
  ]);
});

test("facilitator /supported passes through when reachable", async () => {
  const live = {
    kinds: [{ x402Version: 2, scheme: "exact", network: "xrpl:0" }],
    extensions: ["x402Secure"],
    signers: { "xrpl:*": [] },
  };
  mockFetch(async () => jsonResponse(live));
  const client = new XrplFacilitatorClient("https://facilitator.example");
  const supported = await client.getSupported();
  assert.deepEqual(supported.kinds, live.kinds);
});
