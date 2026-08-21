// Hermetic consumer of epistemedeus/agent-payment-integrity@ef519956
// (0.1.0-candidate.9). Generates the real OpenAPI document, supplies a
// synthetic x402 v2 unpaid 402 equivalent to the verified live terms and
// exact queryful request, and requires an admissible exact-route result.
// No live origin, wallet, or payment header is used.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  bazaarResourceServerExtension,
  extractDiscoveryInfo,
  isValidRouteTemplate,
} from "@x402/extensions/bazaar";
import { usdcAtomicAmount } from "../lib/agent-readiness/product-pricing.js";
import { AUDIT_REPORT_REQUIRED, auditReportSchema } from "../lib/audit-report-schema.js";
import {
  bazaarResourceMeta,
  bazaarRouteTemplate,
  resourceUrl,
} from "../lib/bazaar-catalog.js";
import { openapiDocument } from "../lib/openapi-document.js";
import { quickAuditDiscoveryExtensions } from "../lib/quick-audit-discovery.js";
import { apiProduct } from "../lib/products.js";
import { SELLER, NETWORK, USDC_ASSET } from "../lib/x402-server.js";
import {
  auditIntegrity,
  buildAuditTarget,
} from "./vendor/agent-payment-integrity/integrity.mjs";

const ACTION_COMMIT = "ef519956505b195454aa670230b0936258b451fb";
const INTEGRITY_SHA256 = "8929e9a42849d4290949993a3f48820321b24bbfbb374a71bf995df7ae7e1deb";
const ORIGIN = "https://api.santosautomation.com";
const ROUTE = "/api/audit";

function integritySource() {
  return readFileSync(new URL("./vendor/agent-payment-integrity/integrity.mjs", import.meta.url));
}

function paymentRequiredHeader(resourceUrlValue, extensions) {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    resource: {
      url: resourceUrlValue,
      description: "Run a fast, lightweight audit of a single public web page",
      mimeType: "application/json",
      ...bazaarResourceMeta("quick-audit", { pinResource: false }),
    },
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      amount: usdcAtomicAmount(apiProduct(ROUTE).priceUsdc),
      asset: USDC_ASSET,
      payTo: SELLER,
      maxTimeoutSeconds: 300,
    }],
    extensions,
  })).toString("base64url");
}

function invocationContext(invocation) {
  return {
    method: "GET",
    adapter: {
      getPath: () => ROUTE,
      getUrl: () => invocation,
      getMethod: () => "GET",
    },
    routePattern: ROUTE,
  };
}

test("vendored Action source is candidate.9 integrity.mjs", () => {
  const digest = createHash("sha256").update(integritySource()).digest("hex");
  assert.equal(digest, INTEGRITY_SHA256);
  const source = integritySource().toString("utf8");
  assert.match(source, /0\.1\.0-candidate\.9/);
  assert.equal(ACTION_COMMIT.length, 40);
});

test("official routeTemplate keeps catalog identity query-free while resource binds the invocation", () => {
  const operation = openapiDocument.paths[ROUTE].get;
  const { url: target } = buildAuditTarget(ORIGIN, ROUTE, operation);
  const invocation = target.toString();
  assert.match(invocation, /\?url=/);
  assert.equal(new URL(invocation).searchParams.get("url"), "https://example.com");

  const meta = bazaarResourceMeta("quick-audit", { pinResource: false });
  assert.equal(meta.resource, undefined);
  const resource = meta.resource || invocation;
  assert.equal(resource, invocation);

  const template = bazaarRouteTemplate("quick-audit");
  assert.equal(template, ROUTE);
  assert.equal(isValidRouteTemplate(template), true);

  const declared = quickAuditDiscoveryExtensions();
  assert.equal(declared.bazaar.routeTemplate, template);
  const extensions = {
    bazaar: bazaarResourceServerExtension.enrichDeclaration(declared.bazaar, invocationContext(invocation)),
  };
  assert.equal(extensions.bazaar.routeTemplate, template);
  assert.equal(extensions.bazaar.info.input.method, "GET");

  const payload = {
    x402Version: 2,
    resource: { url: resource },
    accepts: [],
    extensions,
  };
  const discovered = extractDiscoveryInfo(payload, {}, false);
  assert.equal(discovered.resourceUrl, resourceUrl("quick-audit"));
  assert.equal(discovered.resourceUrl, `${ORIGIN}${ROUTE}`);
  assert.equal(discovered.routeTemplate, template);
  assert.equal(new URL(discovered.resourceUrl).search, "");
  assert.notEqual(resource, discovered.resourceUrl);
});

test("exact candidate.9 Action admits the generated OpenAPI document against a synthetic unpaid 402", async () => {
  const operation = openapiDocument.paths[ROUTE].get;
  assert.equal(operation.operationId, "auditWebsite");
  const schema = operation.responses["200"].content["application/json"].schema;
  assert.equal(schema, auditReportSchema);
  assert.equal(JSON.stringify(schema).includes("$ref"), false);
  assert.deepEqual(schema.required, AUDIT_REPORT_REQUIRED);

  const { url: target, queryKeys } = buildAuditTarget(ORIGIN, ROUTE, operation);
  assert.deepEqual(queryKeys, ["url"]);
  const invocation = target.toString();

  const declared = quickAuditDiscoveryExtensions();
  const extensions = {
    bazaar: bazaarResourceServerExtension.enrichDeclaration(declared.bazaar, invocationContext(invocation)),
  };

  const report = await auditIntegrity({
    origin: ORIGIN,
    x402Document: openapiDocument,
    route: ROUTE,
    method: "GET",
    maxRoutes: 1,
    requestImpl: async (url) => ({
      status: 402,
      headers: {
        "payment-required": paymentRequiredHeader(url.toString(), extensions),
      },
      body: Buffer.alloc(0),
    }),
  });

  assert.equal(report.ok, true);
  assert.equal(report.machineBuyable, true);
  assert.equal(report.invalidRoutes, 0);
  assert.equal(report.routes.length, 1);

  const route = report.routes[0];
  assert.equal(route.valid, true);
  assert.equal(route.status, 402);
  assert.equal(route.runtimeChallengeVerified, true);
  assert.deepEqual(route.findings, []);
  assert.equal(route.responseContract.decision, "admissible");
  assert.deepEqual(route.responseContract.unsupportedKeywords, []);
  assert.deepEqual(route.responseContract.structuralProblems, []);
  assert.equal(route.discovery.bazaar.present, true);
  assert.equal(route.discovery.bazaar.valid, true);
  assert.equal(route.economics.x402.amountAtomic, "15000");
  assert.equal(route.economics.x402.network, "eip155:8453");
  assert.equal(route.economics.x402.asset, USDC_ASSET.toLowerCase());
  assert.equal(route.economics.x402.recipient, SELLER.toLowerCase());
  assert.equal(route.economics.x402.scheme, "exact");
  assert.equal(report.safety.paymentSent, false);
  assert.equal(report.safety.paymentSigned, false);
  assert.equal(report.safety.credentialsUsed, false);
});
