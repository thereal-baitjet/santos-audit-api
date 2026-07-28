// Catalog consistency guard. Fails when any public surface — capability
// manifest, llms.txt, marketing content, or the hardcoded-price offenders we
// refactored — disagrees with the canonical catalog in lib/products.js.
// Run: node --test tests/catalog-consistency.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  API_PRODUCTS,
  HUMAN_PRODUCTS,
  PAID_CAPABILITY_COUNT,
  apiProduct,
  apiProducts,
  humanProducts,
} from "../lib/products.js";
import { capabilityManifest } from "../lib/capabilities.js";
import { INDEX_STATS } from "../lib/index-stats.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Canonical truth, confirmed against the production x402 route configuration
// and Stripe checkout defaults (2026-07).
const EXPECTED_API = [
  ["Safe Fetch", "/v1/fetch", "0.002"],
  ["Content Extraction", "/v1/extract", "0.005"],
  ["Feed Parser", "/v1/feed", "0.003"],
  ["Link Map", "/v1/links", "0.003"],
  ["Quick Intelligence Audit", "/api/audit", "0.015"],
  ["Agent Readiness Audit", "/api/agent-readiness", "0.075"],
  ["Screenshot & PDF Render", "/v1/screenshot", "0.01"],
  ["Summarizer", "/v1/summarize", "0.033"],
  ["Structured Extraction", "/v1/extract/structured", "0.08"],
  ["Batch Audit", "/api/audit/batch", "0.50"],
  ["Deep Intelligence Audit", "/v1/audits", "0.225"],
];

const EXPECTED_HUMAN = [
  ["Quick Report", 9, "one-time"],
  ["Deep Report", 29, "one-time"],
  ["Monitoring", 9, "monthly"],
];

test("catalog contains exactly the eleven canonical paid capabilities", () => {
  assert.equal(PAID_CAPABILITY_COUNT, 11);
  assert.equal(API_PRODUCTS.length, EXPECTED_API.length);
  const resolved = apiProducts();
  for (const [name, route, price] of EXPECTED_API) {
    const product = resolved.find((entry) => entry.route === route);
    assert.ok(product, `missing API product for route ${route}`);
    assert.equal(product.name, name, `name mismatch for ${route}`);
    assert.equal(product.priceUsdc, price, `price mismatch for ${route}: ${product.priceUsdc} != ${price}`);
    assert.ok(product.billingUnit, `missing billing unit for ${route}`);
    assert.equal(product.availability, "live");
  }
});

test("catalog contains the three canonical human products", () => {
  assert.equal(HUMAN_PRODUCTS.length, EXPECTED_HUMAN.length);
  const resolved = humanProducts();
  for (const [name, price, billing] of EXPECTED_HUMAN) {
    const product = resolved.find((entry) => entry.name === name);
    assert.ok(product, `missing human product ${name}`);
    assert.equal(product.priceUsd, price, `price mismatch for ${name}`);
    assert.equal(product.billing, billing);
  }
});

test("capability manifest prices and human purchase block match the catalog", () => {
  const manifest = capabilityManifest();
  const paid = manifest.capabilities.filter((capability) => Number(capability.price.amount) > 0);
  assert.equal(paid.length, PAID_CAPABILITY_COUNT, "manifest paid-capability count disagrees with catalog");
  for (const product of apiProducts()) {
    const capability = manifest.capabilities.find((entry) => entry.endpoint.includes(product.route));
    assert.ok(capability, `manifest missing capability for ${product.route}`);
    assert.equal(capability.price.amount, product.priceUsdc, `manifest price mismatch for ${product.route}`);
  }
  const humans = manifest.human_purchase.products;
  assert.equal(humans.length, 3);
  for (const product of humanProducts()) {
    // Quick and Deep share the /agent-readiness/buy URL, so match on the tier
    // word in the manifest product name and assert the URL separately.
    const entry = humans.find((human) => human.product.toLowerCase().includes(product.tier));
    assert.ok(entry, `manifest missing human product ${product.name}`);
    assert.ok(entry.url.endsWith(product.url), `manifest url mismatch for ${product.name}`);
    assert.equal(Number(entry.price.amount), product.priceUsd, `manifest human price mismatch for ${product.name}`);
  }
});

test("llms.txt lists every capability with the catalog price and no retired prices", () => {
  const llms = read("public/llms.txt");
  for (const product of apiProducts()) {
    assert.ok(llms.includes(product.route), `llms.txt missing route ${product.route}`);
    assert.ok(llms.includes(`$${product.priceUsdc}`), `llms.txt missing price $${product.priceUsdc} for ${product.name}`);
  }
  for (const product of humanProducts()) {
    assert.ok(llms.includes(`$${product.priceUsd}`), `llms.txt missing human price $${product.priceUsd}`);
  }
  assert.ok(!/\$5\b/.test(llms), "llms.txt still mentions the retired $5 human report");
});

test("static public widget scripts carry current prices and no retired prices", () => {
  const quick = apiProduct("quick-intelligence");
  const extract = apiProduct("content-extraction");
  const webmcp = read("public/webmcp.js");
  assert.ok(webmcp.includes(quick.priceUsdc), "webmcp.js quick price drifted from catalog");
  assert.ok(webmcp.includes(extract.priceUsdc), "webmcp.js extract price drifted from catalog");
  for (const path of ["public/audit-widget.js", "public/llms-txt-widget.js", "public/webmcp.js"]) {
    assert.ok(!/\$5\b/.test(read(path)), `${path} still mentions the retired $5 human report`);
  }
  for (const product of humanProducts()) {
    if (product.tier === "monitoring") continue;
    assert.ok(read("public/audit-widget.js").includes(`$${product.priceUsd}`), `audit-widget.js missing $${product.priceUsd}`);
  }
});

test("refactored source surfaces carry no hardcoded price literals", () => {
  // These files must derive prices from lib/products.js (or env), never embed
  // price literals. Guards against drift being reintroduced.
  const offenders = [
    ["app/docs/page.js", [/\$\d+\.\d+/, /0\.0(?:0[235]|15|33|75)|0\.225|0\.50/]],
    ["app/api/route.js", [/0\.015|15000/]],
    ["app/openapi.json/route.js", [/0\.015|0\.08[^0-9]|0\.50|0\.225|0\.0(?:02|05|03|33)|\$0\.01/]],
    ["app/mcp/route.js", [/\$0\.015/]],
    ["app/page.js", [/\$0\.0|0\.015|0\.225|Union City/]],
  ];
  for (const [path, patterns] of offenders) {
    const source = read(path);
    for (const pattern of patterns) {
      assert.ok(!pattern.test(source), `${path} contains hardcoded price/location literal matching ${pattern}`);
    }
  }
});

test("index statistics claims match the canonical index stats", () => {
  // Derived from scripts/seed-results.jsonl (307 domains, avg 59.2, median 58).
  assert.equal(INDEX_STATS.auditedSiteCountLabel, "300+");
  assert.equal(INDEX_STATS.averageScore, 59);
  assert.equal(INDEX_STATS.medianScore, 58);
  const marketing = read("lib/marketing-content.js");
  assert.ok(!/median\s+(?:of\s+)?57\b/.test(marketing), "marketing content still claims the stale median of 57");
  assert.ok(!/google\.com[^.]*\b37\b/.test(marketing), "marketing content still claims the stale google.com score of 37");
  const homepage = read("app/page.js");
  assert.ok(!/median[^<]*57/i.test(homepage), "homepage still claims the stale median of 57");
});
