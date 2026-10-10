import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyPublicListingHeader, publicListingHeader, wantsPublicListing } from "../lib/public-listing.js";

const params = (q) => new URLSearchParams(q);

test("?public accepts the usual truthy spellings; anything else is off", () => {
  for (const q of ["public=1", "public=true", "public=TRUE", "public=yes", "public=on", "public= true "]) assert.equal(wantsPublicListing(params(q)), true, q);
  for (const q of ["", "public=0", "public=false", "public=", "public=maybe", "pub=1"]) assert.equal(wantsPublicListing(params(q)), false, q);
});

test("the listing outcome is reported in a header, with the report URL", () => {
  assert.equal(publicListingHeader("not-requested"), "not-requested");
  assert.equal(publicListingHeader("failed"), "failed");
  assert.equal(publicListingHeader("listed", "https://www.Example.com/path"), "listed; url=https://www.santosautomation.com/reports/example.com");
  const res = applyPublicListingHeader(new Response(null, { headers: { "Access-Control-Expose-Headers": "PAYMENT-RESPONSE" } }), "listed");
  assert.equal(res.headers.get("x-santos-public-listing"), "listed");
  assert.equal(res.headers.get("access-control-expose-headers"), "PAYMENT-RESPONSE, X-Santos-Public-Listing");
});

test("both paid audit routes use the shared flag and expose the header; OpenAPI documents it", () => {
  for (const file of ["app/api/agent-readiness/route.js", "app/api/audit/route.js"]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(src.includes("wantsPublicListing(req.nextUrl.searchParams)"), `${file} parses ?public with the shared helper`);
    assert.ok(!/get\("public"\) === "1"/.test(src), `${file} still only accepts public=1`);
    assert.match(src, /Access-Control-Expose-Headers", "[^"]*X-Santos-Public-Listing/, `${file} exposes the header`);
  }
  const openapi = readFileSync(new URL("../app/openapi.json/route.js", import.meta.url), "utf8");
  assert.equal((openapi.match(/publicParam\]/g) ?? []).length, 2, "both routes list the public parameter");
});
