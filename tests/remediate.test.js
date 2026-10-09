import test from "node:test";
import assert from "node:assert/strict";
import {
  RemediationError,
  buildRemediation,
  generateJsonLdSchema,
  generateLlmsText,
  normalizeDomain,
  parseRemediateRequest,
} from "../lib/remediate.ts";

const valid = (overrides = {}) => ({
  domain: "https://www.acme.com/",
  siteDescription: "Acme sells industrial anvils to cartoon coyotes.",
  failedLayers: ["discoverable", "understandable", "callable"],
  existingEndpoints: [
    { path: "/api/products", method: "GET", desc: "List anvils" },
    { path: "/api/orders", method: "POST", desc: "Place an order" },
  ],
  ...overrides,
});

function rejects(body, field) {
  assert.throws(() => parseRemediateRequest(body), (e) => {
    assert.ok(e instanceof RemediationError);
    assert.equal(e.code, "INVALID_REQUEST");
    assert.equal(e.status, 400);
    assert.ok(e.details.some((d) => d.field === field), `expected an issue on ${field}, got ${JSON.stringify(e.details)}`);
    return true;
  });
}

test("normalizeDomain accepts bare hosts and origins, and strips www for the name", () => {
  assert.deepEqual(normalizeDomain("Example.COM"), { hostname: "example.com", origin: "https://example.com", name: "example.com" });
  assert.deepEqual(normalizeDomain("https://www.acme.com/"), { hostname: "www.acme.com", origin: "https://www.acme.com", name: "acme.com" });
  assert.equal(normalizeDomain("http://acme.com").origin, "http://acme.com");
});

test("normalizeDomain rejects IPs, paths, credentials, single labels, and other schemes", () => {
  for (const bad of ["127.0.0.1", "http://[::1]", "acme.com/admin", "acme.com?x=1", "https://u:p@acme.com", "localhost", "ftp://acme.com", "javascript:alert(1)", " "]) {
    assert.throws(() => normalizeDomain(bad), RemediationError, bad);
  }
});

test("generateLlmsText follows the llmstxt.org layout", () => {
  const txt = generateLlmsText("acme.com", "Anvils.", valid().existingEndpoints);
  assert.equal(
    txt,
    [
      "# acme.com",
      "",
      "> Anvils.",
      "",
      "All URLs below are absolute; the canonical origin is https://acme.com.",
      "",
      "## API",
      "",
      "- [GET /api/products](https://acme.com/api/products): List anvils",
      "- [POST /api/orders](https://acme.com/api/orders): Place an order",
      "",
      "## Optional",
      "",
      "- [Home](https://acme.com/): Human-facing homepage",
      "",
    ].join("\n")
  );
});

test("generateLlmsText neutralises Markdown structure in untrusted text", () => {
  const txt = generateLlmsText("acme.com", "Line one\n# Fake heading\u2028## Injected", [
    { path: "/a", method: "GET", desc: "ok\n## Evil section\n- [x](https://evil.example)" },
    { path: "/b)(https://evil.example", method: "GET", desc: "bad path is dropped" },
  ]);
  assert.equal(txt.split("\n").filter((l) => l.startsWith("#")).length, 3, "only H1, API and Optional headings");
  assert.match(txt, /^> Line one # Fake heading ## Injected$/m);
  assert.doesNotMatch(txt, /bad path is dropped/);
});

test("generateLlmsText omits the API section when there are no endpoints", () => {
  assert.doesNotMatch(generateLlmsText("acme.com", "Anvils.", []), /## API/);
});

test("generateJsonLdSchema emits a valid Organization that cannot close its script tag", () => {
  const { data, script } = generateJsonLdSchema("www.acme.com", "Anvils </script><script>alert(1)</script> & more");
  assert.equal(data["@type"], "Organization");
  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data.url, "https://www.acme.com/");
  assert.equal(data.name, "acme.com");
  assert.ok(script.startsWith('<script type="application/ld+json">\n'));
  assert.ok(script.endsWith("\n</script>"));
  const inner = script.slice(script.indexOf("\n") + 1, script.lastIndexOf("\n"));
  assert.doesNotMatch(inner, /[<>&]/);
  assert.deepEqual(JSON.parse(inner), data, "escaped JSON must round-trip");
});

test("parseRemediateRequest returns a typed, deduplicated request", () => {
  const { request, site } = parseRemediateRequest(valid({
    failedLayers: ["callable", "callable"],
    existingEndpoints: [
      { path: "/a", method: "GET", desc: "  first \t one " },
      { path: "/a", method: "GET", desc: "duplicate" },
    ],
  }));
  assert.equal(site.origin, "https://www.acme.com");
  assert.deepEqual(request.failedLayers, ["callable"]);
  assert.deepEqual(request.existingEndpoints, [{ path: "/a", method: "GET", desc: "first one" }]);
});

test("existingEndpoints is optional", () => {
  const { request } = parseRemediateRequest(valid({ existingEndpoints: undefined }));
  assert.deepEqual(request.existingEndpoints, []);
});

test("parseRemediateRequest reports each invalid field", () => {
  rejects(null, "(body)");
  rejects(valid({ domain: 42 }), "domain");
  rejects(valid({ siteDescription: "   " }), "siteDescription");
  rejects(valid({ siteDescription: "x".repeat(1001) }), "siteDescription");
  rejects(valid({ failedLayers: [] }), "failedLayers");
  rejects(valid({ failedLayers: ["trustworthy"] }), "failedLayers[0]");
  rejects(valid({ existingEndpoints: {} }), "existingEndpoints");
  rejects(valid({ existingEndpoints: [{ path: "no-slash", method: "GET", desc: "" }] }), "existingEndpoints[0].path");
  rejects(valid({ existingEndpoints: [{ path: "//evil.example", method: "GET", desc: "" }] }), "existingEndpoints[0].path");
  rejects(valid({ existingEndpoints: [{ path: "/a", method: "DELETE", desc: "" }] }), "existingEndpoints[0].method");
  rejects(valid({ existingEndpoints: Array.from({ length: 101 }, (_, i) => ({ path: `/p${i}`, method: "GET", desc: "" })) }), "existingEndpoints");
});

test("all issues are reported together", () => {
  assert.throws(() => parseRemediateRequest({ domain: "", siteDescription: 1, failedLayers: "x" }), (e) => {
    assert.deepEqual(e.details.map((d) => d.field).sort(), ["domain", "failedLayers", "siteDescription"]);
    return true;
  });
});

test("buildRemediation only generates artifacts for the layers that failed", () => {
  const only = (failedLayers) => {
    const { request, site } = parseRemediateRequest(valid({ failedLayers }));
    return buildRemediation(request, site);
  };

  const understandable = only(["understandable"]);
  assert.equal(understandable.artifacts.llmsTxt, null);
  assert.deepEqual(understandable.artifacts.jsonLd.addresses, ["understandable"]);

  const discoverable = only(["discoverable"]);
  assert.equal(discoverable.artifacts.jsonLd, null);
  assert.equal(discoverable.artifacts.llmsTxt.path, "/llms.txt");
  assert.deepEqual(discoverable.artifacts.llmsTxt.addresses, ["discoverable"]);

  const all = only(["discoverable", "understandable", "callable"]);
  assert.deepEqual(all.artifacts.llmsTxt.addresses, ["discoverable", "callable"]);
  assert.deepEqual(all.warnings, []);
});

test("buildRemediation warns when callable failed without any endpoints", () => {
  const { request, site } = parseRemediateRequest(valid({ failedLayers: ["callable"], existingEndpoints: [] }));
  const result = buildRemediation(request, site);
  assert.equal(result.warnings.length, 1);
  assert.doesNotMatch(result.artifacts.llmsTxt.content, /## API/);
});

// ── Free-with-report access ─────────────────────────────────────────────────

const { checkReportForSite } = await import("../lib/remediate-report.ts");
const { signReport } = await import("../lib/report-signing.js");

const readinessReport = (origin = "https://www.acme.com") =>
  signReport({
    schema_version: "1.0.0",
    target: { requested_url: origin, canonical_origin: origin, final_url: `${origin}/` },
    score: 41,
    findings: [],
  });

const reportError = (fn, code) =>
  assert.throws(fn, (e) => {
    assert.ok(e instanceof RemediationError);
    assert.equal(e.code, code);
    assert.equal(e.status, 403);
    return true;
  });

test("a signed Agent Readiness report for the same domain grants access", () => {
  const report = readinessReport();
  assert.deepEqual(checkReportForSite(report, normalizeDomain("www.acme.com")), { signature: report.signature });
  // www. is ignored on both sides.
  assert.ok(checkReportForSite(report, normalizeDomain("acme.com")));
  assert.ok(checkReportForSite(readinessReport("https://acme.com"), normalizeDomain("www.acme.com")));
});

test("a tampered or unsigned report is rejected", () => {
  const tampered = { ...readinessReport(), score: 99 };
  reportError(() => checkReportForSite(tampered, normalizeDomain("acme.com")), "INVALID_REPORT");
  const { signature, ...unsigned } = readinessReport();
  reportError(() => checkReportForSite(unsigned, normalizeDomain("acme.com")), "INVALID_REPORT");
  reportError(() => checkReportForSite("not a report", normalizeDomain("acme.com")), "INVALID_REPORT");
});

test("an edited signed_at does not invalidate the signature, so it is not used for access", () => {
  const report = { ...readinessReport(), signed_at: "2099-01-01T00:00:00.000Z" };
  assert.equal(checkReportForSite(report, normalizeDomain("acme.com")).signature, report.signature);
});

test("signed reports of other types do not qualify", () => {
  const quick = signReport({ tier: "paid", url: "https://acme.com", agent_readiness: { findings: [], target: { canonical_origin: "https://acme.com" } } });
  reportError(() => checkReportForSite(quick, normalizeDomain("acme.com")), "INVALID_REPORT");
});

test("a report for a different domain is rejected", () => {
  reportError(() => checkReportForSite(readinessReport("https://evil.example"), normalizeDomain("acme.com")), "REPORT_DOMAIN_MISMATCH");
  reportError(() => checkReportForSite(readinessReport("https://shop.acme.com"), normalizeDomain("acme.com")), "REPORT_DOMAIN_MISMATCH");
});

// ── Published reports never qualify ─────────────────────────────────────────

const { assertReportUnpublished } = await import("../lib/remediate-report.ts");
const { markReportPublished, upsertPublicReport } = await import("../lib/public-reports.js");

const unpublishedCode = async (report) => {
  try {
    await assertReportUnpublished(report);
    return null;
  } catch (e) {
    return e.code;
  }
};

test("a private report passes the published check", async () => {
  assert.equal(await unpublishedCode(readinessReport("https://private-co.com")), null);
});

test("a report that is the current public listing is rejected", async () => {
  // Published before marks existed: no mark, but still the live listing.
  const report = readinessReport("https://listed-co.com");
  await upsertPublicReport({ url: "https://listed-co.com/", score: 41, report, source: "agent-readiness-paid" });
  assert.equal(await unpublishedCode(report), "REPORT_PUBLISHED");
});

test("a published report stays rejected after a newer report replaces its listing", async () => {
  const first = readinessReport("https://replaced-co.com");
  await markReportPublished(first);
  await upsertPublicReport({ url: "https://replaced-co.com/", score: 41, report: first, source: "agent-readiness-paid" });

  const second = signReport({ ...readinessReport("https://replaced-co.com"), score: 77 });
  await markReportPublished(second);
  await upsertPublicReport({ url: "https://replaced-co.com/", score: 77, report: second, source: "agent-readiness-paid" });

  assert.equal(await unpublishedCode(first), "REPORT_PUBLISHED");
  assert.equal(await unpublishedCode(second), "REPORT_PUBLISHED");
});

test("the agent-readiness route marks a report before listing it", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../app/api/agent-readiness/route.js", import.meta.url), "utf8");
  const mark = src.indexOf("markReportPublished(signed)");
  assert.ok(mark > 0, "public listing must mark the report as published");
  assert.ok(mark < src.indexOf("upsertPublicReport({"), "mark must precede the listing so a failure cannot leave it unmarked");
});
