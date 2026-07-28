#!/usr/bin/env node
// Verify that every paid Santos endpoint advertises its own distinct x402
// Bazaar resource, and print a report suitable for sending to Agentic Market
// support.
//
// Usage:
//   node scripts/verify-bazaar-discovery.js                  # unpaid probe (free)
//   node scripts/verify-bazaar-discovery.js --base https://…  # probe another host
//   node scripts/verify-bazaar-discovery.js --expect-base https://…
//   node scripts/verify-bazaar-discovery.js --json           # machine-readable
//   node scripts/verify-bazaar-discovery.js --paid           # REAL USDC settlements
//
// The default run sends one unpaid but otherwise valid request per route and
// asserts the 402 challenge. It spends nothing. `--paid` additionally settles a
// real payment per route so the Bazaar acknowledgement (EXTENSION-RESPONSES)
// can be read — that costs actual USDC and needs BUYER_PRIVATE_KEY.

import { BAZAAR_ROUTES, RESOURCE_BASE_URL, MAX_BAZAAR_TAGS } from "../lib/bazaar-catalog.js";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(name);

const BASE = flag("--base", process.env.API_BASE_URL || "https://api.santosautomation.com").replace(/\/+$/, "");
// What resource.url *should* say. Defaults to the catalog's canonical base so a
// preview deploy can be probed while still asserting production identity.
const EXPECT_BASE = flag("--expect-base", RESOURCE_BASE_URL).replace(/\/+$/, "");
const AS_JSON = has("--json");
const PAID = has("--paid");

const decodeB64Json = (value) => JSON.parse(Buffer.from(value, "base64").toString("utf-8"));

/** Build the unpaid probe request for a route from its catalog example. */
function buildRequest(route) {
  const { method, query, body } = route.probe;
  const url = new URL(`${BASE}${route.path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const init = { method, headers: {} };
  if (body) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return { url: url.toString(), init };
}

/** Probe one route unpaid and pull its advertised Bazaar identity out of the 402. */
async function probe(route) {
  const { url, init } = buildRequest(route);
  const row = {
    id: route.id,
    method: route.probe.method,
    route: route.path,
    requestUrl: url,
    expectedResourceUrl: `${EXPECT_BASE}${route.path}`,
    errors: [],
  };

  let res;
  try {
    res = await fetch(url, init);
  } catch (error) {
    row.errors.push(`request failed: ${error.message}`);
    return row;
  }

  row.status = res.status;
  if (res.status !== 402) {
    row.errors.push(`expected HTTP 402, got ${res.status}`);
  }

  const header = res.headers.get("PAYMENT-REQUIRED");
  if (!header) {
    row.errors.push("no PAYMENT-REQUIRED header");
    return row;
  }

  let challenge;
  try {
    challenge = decodeB64Json(header);
  } catch (error) {
    row.errors.push(`PAYMENT-REQUIRED not base64 JSON: ${error.message}`);
    return row;
  }

  row.resourceUrl = challenge.resource?.url;
  row.serviceName = challenge.resource?.serviceName;
  row.iconUrl = challenge.resource?.iconUrl;
  row.tags = challenge.resource?.tags ?? [];

  if (!row.resourceUrl) {
    row.errors.push("challenge carries no resource.url");
  } else if (row.resourceUrl !== row.expectedResourceUrl) {
    row.errors.push(`resource.url is "${row.resourceUrl}", expected "${row.expectedResourceUrl}"`);
  }

  const bazaar = challenge.extensions?.bazaar;
  row.hasBazaar = Boolean(bazaar);
  if (!bazaar) {
    row.errors.push("no extensions.bazaar in the 402 challenge");
    return row;
  }

  row.bazaarMethod = bazaar.info?.input?.method;
  row.bazaarInputShape = bazaar.info?.input?.bodyType ? "body" : "queryParams";
  row.hasOutputExample = Boolean(bazaar.info?.output?.example);
  row.hasOutputSchema = Boolean(bazaar.schema?.properties?.output);

  if (row.bazaarMethod !== route.probe.method) {
    row.errors.push(`bazaar input method "${row.bazaarMethod}" != request method "${route.probe.method}"`);
  }
  // A GET route advertising a JSON body (or a POST advertising query params)
  // hands the marketplace a request shape that cannot be replayed.
  const expectedShape = route.style[route.probe.method] === "body" ? "body" : "queryParams";
  if (row.bazaarInputShape !== expectedShape) {
    row.errors.push(`bazaar input shape "${row.bazaarInputShape}", expected "${expectedShape}" for ${route.probe.method}`);
  }
  if (!row.hasOutputExample) row.errors.push("bazaar declares no output example");
  if (!row.hasOutputSchema) row.errors.push("bazaar declares no output schema");
  if (row.tags.length < 2) row.errors.push(`only ${row.tags.length} tag(s); want 2-${MAX_BAZAAR_TAGS}`);
  if (row.tags.length > MAX_BAZAAR_TAGS) row.errors.push(`${row.tags.length} tags exceeds the Bazaar cap of ${MAX_BAZAAR_TAGS}`);
  if (!row.iconUrl) row.errors.push("no resource.iconUrl");

  return row;
}

/**
 * Settle a real payment and read the Bazaar acknowledgement. Only runs under
 * --paid; imports the buyer stack lazily so the free path needs no key.
 */
async function paidProbe(route, row) {
  const { privateKeyToAccount } = await import("viem/accounts");
  const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm");

  const key = process.env.BUYER_PRIVATE_KEY;
  if (!key) throw new Error("--paid needs BUYER_PRIVATE_KEY");

  const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(privateKeyToAccount(key)) }],
  });

  const { url, init } = buildRequest(route);
  const res = await payFetch(url, init);
  row.paidStatus = res.status;

  const ext = res.headers.get("EXTENSION-RESPONSES");
  if (!ext) {
    row.bazaarStatus = "no-ack";
    return row;
  }
  try {
    const decoded = decodeB64Json(ext);
    const bazaar = decoded?.bazaar ?? {};
    row.bazaarStatus = bazaar.status ?? "unknown";
    row.bazaarRejectedReason = bazaar.rejectedReason ?? bazaar.reason ?? undefined;
    if (row.bazaarStatus === "rejected") {
      row.errors.push(`bazaar rejected: ${row.bazaarRejectedReason ?? "no reason given"}`);
    }
  } catch (error) {
    row.bazaarStatus = "undecodable";
    row.errors.push(`EXTENSION-RESPONSES not base64 JSON: ${error.message}`);
  }
  return row;
}

function renderTable(rows) {
  const cols = [
    ["METHOD", (r) => r.method ?? "-"],
    ["ROUTE", (r) => r.route],
    ["RESOURCE.URL", (r) => r.resourceUrl ?? "(none)"],
    ["BAZAAR IN", (r) => (r.hasBazaar ? `${r.bazaarMethod ?? "?"}/${r.bazaarInputShape ?? "?"}` : "(absent)")],
    ["BAZAAR STATUS", (r) => r.bazaarStatus ?? (r.hasBazaar ? "declared" : "missing")],
    ["OK", (r) => (r.errors.length === 0 ? "yes" : "NO")],
  ];
  const widths = cols.map(([head, get]) =>
    Math.max(head.length, ...rows.map((r) => String(get(r)).length))
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(line(cols.map(([h]) => h)));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(cols.map(([, get]) => get(r))));
}

async function main() {
  console.log(`x402 Bazaar discovery verification`);
  console.log(`probing:  ${BASE}`);
  console.log(`expecting resource.url base: ${EXPECT_BASE}`);
  console.log(`mode:     ${PAID ? "PAID (real USDC settlements)" : "unpaid 402 probe (free)"}`);
  console.log(`utc:      ${new Date().toISOString()}\n`);

  const rows = [];
  for (const route of BAZAAR_ROUTES) {
    const row = await probe(route);
    if (PAID && row.errors.length === 0) {
      try {
        await paidProbe(route, row);
      } catch (error) {
        row.errors.push(`paid probe failed: ${error.message}`);
      }
    }
    rows.push(row);
  }

  // The acceptance criterion: eleven endpoints, eleven distinct resource URLs.
  const seen = new Map();
  for (const row of rows) {
    if (!row.resourceUrl) continue;
    if (seen.has(row.resourceUrl)) {
      const clash = seen.get(row.resourceUrl);
      row.errors.push(`resource.url collides with ${clash}`);
      rows.find((r) => r.route === clash)?.errors.push(`resource.url collides with ${row.route}`);
    } else {
      seen.set(row.resourceUrl, row.route);
    }
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, expectBase: EXPECT_BASE, paid: PAID, rows }, null, 2));
  } else {
    renderTable(rows);
    const failed = rows.filter((r) => r.errors.length > 0);
    if (failed.length) {
      console.log("\nFailures:");
      for (const r of failed) for (const e of r.errors) console.log(`  ${r.route}: ${e}`);
    }
    console.log(`\nroutes probed:          ${rows.length}`);
    console.log(`distinct resource.url:  ${seen.size}`);
    console.log(`routes passing:         ${rows.length - failed.length}/${rows.length}`);
  }

  const ok = rows.every((r) => r.errors.length === 0) && seen.size === BAZAAR_ROUTES.length;
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
