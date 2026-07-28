#!/usr/bin/env node
// Read the CDP x402 Bazaar catalog and report what it holds for a domain.
//
// The Bazaar has no per-resource lookup and no filter parameter — the discovery
// API only pages through every resource it knows about. So "is my endpoint
// listed?" means scanning the whole catalog, which is what this does.
//
// Indexing is driven by settled payments and is NOT immediate: allow roughly
// three hours after a settlement before treating an absence as meaningful.
//
// Usage:
//   node scripts/read-bazaar.js                     # Santos entries vs expected
//   node scripts/read-bazaar.js --domain foo.com    # any domain
//   node scripts/read-bazaar.js --all               # whole-catalog summary
//   node scripts/read-bazaar.js --json              # machine-readable
//   node scripts/read-bazaar.js --max-pages 40      # bound a slow scan

import { BAZAAR_ROUTES, RESOURCE_BASE_URL } from "../lib/bazaar-catalog.js";

const DISCOVERY = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const PAGE_SIZE = 100;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(name);

const DOMAIN = flag("--domain", new URL(RESOURCE_BASE_URL).hostname.replace(/^api\./, ""));
const MAX_PAGES = Number(flag("--max-pages", "120"));
const AS_JSON = has("--json");
const SHOW_ALL = has("--all");

// The discovery API is occasionally flaky mid-scan; a reset connection halfway
// through would otherwise look like "no entries found", which is exactly the
// wrong conclusion to draw.
async function fetchPage(offset, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${DISCOVERY}?limit=${PAGE_SIZE}&offset=${offset}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === attempts) throw new Error(`offset ${offset}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const resourceUrlOf = (entry) => {
  const r = entry?.resource;
  return typeof r === "string" ? r : r?.url ?? null;
};

const ageOf = (iso) => {
  if (!iso) return "—";
  const hours = (Date.now() - Date.parse(iso)) / 3.6e6;
  if (!Number.isFinite(hours)) return "—";
  return hours < 48 ? `${hours.toFixed(1)}h ago` : `${(hours / 24).toFixed(1)}d ago`;
};

async function scan() {
  const matches = [];
  let offset = 0;
  let total = 0;
  let pages = 0;
  const sellers = new Map();

  while (pages < MAX_PAGES) {
    const page = await fetchPage(offset);
    const items = page.items ?? page.resources ?? [];
    if (!items.length) break;
    pages++;
    total += items.length;

    for (const item of items) {
      const url = resourceUrlOf(item);
      if (url?.includes(DOMAIN)) matches.push(item);
      if (SHOW_ALL && url) {
        try {
          const host = new URL(url).hostname;
          sellers.set(host, (sellers.get(host) ?? 0) + 1);
        } catch { /* skip unparseable resource urls */ }
      }
    }
    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { matches, total, pages, sellers, truncated: pages >= MAX_PAGES };
}

function report({ matches, total, pages, sellers, truncated }) {
  console.log(`x402 Bazaar catalog`);
  console.log(`scanned:  ${total} resources across ${pages} page(s)${truncated ? " (TRUNCATED — raise --max-pages)" : ""}`);
  console.log(`domain:   ${DOMAIN}`);
  console.log(`utc:      ${new Date().toISOString()}\n`);

  if (!matches.length) {
    console.log(`No catalog entries for ${DOMAIN}.`);
  } else {
    for (const entry of matches) {
      const url = resourceUrlOf(entry);
      console.log(`  ${url}`);
      console.log(`     serviceName : ${entry.serviceName ?? "—"}`);
      console.log(`     tags        : ${(entry.tags ?? []).join(", ") || "—"}`);
      console.log(`     iconUrl     : ${entry.iconUrl ? "set" : "MISSING"}`);
      console.log(`     lastUpdated : ${entry.lastUpdated ?? "—"}  (${ageOf(entry.lastUpdated)})`);
      console.log(`     bazaar ext  : ${entry.extensions?.bazaar ? "present" : "absent"}`);
    }
  }

  // Only meaningful for our own domain: compare against the canonical catalog.
  if (DOMAIN.includes("santosautomation")) {
    const listed = new Set(matches.map(resourceUrlOf));
    const expected = BAZAAR_ROUTES.map((r) => `${RESOURCE_BASE_URL}${r.path}`);
    const missing = expected.filter((u) => !listed.has(u));
    console.log(`\nexpected paid resources: ${expected.length}`);
    console.log(`listed:                  ${expected.length - missing.length}`);
    if (missing.length) {
      console.log(`missing:                 ${missing.length}`);
      for (const u of missing) console.log(`   - ${u}`);
      console.log(
        `\nIndexing follows a settled payment and is not immediate (~3h).\n` +
        `If these are still absent well past that window after a settlement,\n` +
        `the settlement is not reaching the catalog — see docs/bazaar-discovery.md.`
      );
    }
  }

  if (SHOW_ALL) {
    console.log(`\ntop sellers by resource count:`);
    for (const [host, count] of [...sellers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`   ${String(count).padStart(4)}  ${host}`);
    }
  }
}

const result = await scan();
if (AS_JSON) {
  console.log(JSON.stringify({
    domain: DOMAIN,
    scanned: result.total,
    pages: result.pages,
    truncated: result.truncated,
    scannedAt: new Date().toISOString(),
    entries: result.matches,
  }, null, 2));
} else {
  report(result);
}
