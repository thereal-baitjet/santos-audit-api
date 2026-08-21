// Source-level gates for the GET /api/audit payment declaration and the
// manual seller-contract-integrity workflow. Hermetic: no live origin,
// wallet, or payment header.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { usdcAtomicAmount } from "../lib/agent-readiness/product-pricing.js";
import { SELLER, NETWORK, USDC_ASSET } from "../lib/x402-server.js";
import { apiProduct } from "../lib/products.js";
import { AUDIT_REPORT_REQUIRED, auditReportSchema } from "../lib/audit-report-schema.js";
import { openapiDocument } from "../lib/openapi-document.js";
import {
  QUICK_AUDIT_METHOD,
  QUICK_AUDIT_ROUTE,
  quickAuditPaymentInfo,
} from "../lib/openapi-payment-info.js";

const ACTION_SHA = "ef519956505b195454aa670230b0936258b451fb";
const WORKFLOW_PATH = ".github/workflows/seller-contract-integrity.yml";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ExactEvmScheme default asset and atomic amount match the declared rail", async () => {
  const product = apiProduct(QUICK_AUDIT_ROUTE);
  const parsed = await new ExactEvmScheme().parsePrice(`$${product.priceUsdc}`, NETWORK);
  assert.equal(parsed.asset, USDC_ASSET);
  assert.equal(parsed.amount, usdcAtomicAmount(product.priceUsdc));
  assert.equal(parsed.amount, "15000");
});

test("generated OpenAPI declares exactly GET /api/audit with route-owned payment facts", () => {
  const info = quickAuditPaymentInfo();
  const product = apiProduct(QUICK_AUDIT_ROUTE);
  assert.equal(info.price.amount, product.priceUsdc);
  assert.equal(info.protocols[0].x402.payTo, SELLER);
  assert.equal(info.protocols[0].x402.network, NETWORK);
  assert.equal(info.protocols[0].x402.asset, USDC_ASSET);

  const auditGet = openapiDocument.paths[QUICK_AUDIT_ROUTE].get;
  assert.equal(auditGet.operationId, "auditWebsite");
  assert.deepEqual(auditGet["x-payment-info"], info);
  const paidOps = [];
  for (const item of Object.values(openapiDocument.paths)) {
    for (const operation of Object.values(item)) {
      if (operation?.["x-payment-info"]) paidOps.push(operation);
    }
  }
  assert.equal(paidOps.length, 1, "unrelated OpenAPI operations must not declare x-payment-info");

  const schema = auditGet.responses["200"].content["application/json"].schema;
  assert.equal(schema, auditReportSchema);
  assert.deepEqual(schema.required, AUDIT_REPORT_REQUIRED);
  assert.equal(JSON.stringify(schema).includes("$ref"), false);
  assert.deepEqual(schema.properties.tier, { type: "string", enum: ["paid"] });

  const openapiSrc = read("lib/openapi-document.js");
  assert.ok(
    openapiSrc.includes('"x-payment-info": quickAuditPaymentInfo()'),
    "GET /api/audit must generate x-payment-info from route-owned facts"
  );
  const paymentInfoSrc = read("lib/openapi-payment-info.js");
  assert.match(paymentInfoSrc, /agent-payment-integrity-compatible seller audit declaration/);
  assert.equal(paymentInfoSrc.includes("Standard OpenAPI"), false);
});

test("seller-contract-integrity workflow is manual-only and SHA-pinned", () => {
  const source = read(WORKFLOW_PATH);
  const workflow = parseYaml(source);

  assert.match(source, /meaningful only after the .*declaration is deployed/i);
  assert.match(source, /not a PR-time deployment gate/i);

  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.on.pull_request, undefined);
  assert.equal(workflow.on.schedule, undefined);

  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.environment, undefined);
  assert.deepEqual(Object.keys(workflow.jobs), ["audit"]);

  const job = workflow.jobs.audit;
  assert.equal(job.environment, undefined);
  assert.equal(job.steps.length, 1);
  const step = job.steps[0];
  assert.equal(step.uses, `epistemedeus/agent-payment-integrity@${ACTION_SHA}`);
  assert.match(step.uses, /@[0-9a-f]{40}$/);
  assert.equal(step.with.origin, "https://api.santosautomation.com");
  assert.equal(step.with.route, QUICK_AUDIT_ROUTE);
  assert.equal(step.with.method, QUICK_AUDIT_METHOD);
  assert.equal(String(step.with["max-routes"]), "1");
  assert.equal(String(step.with["upload-sarif"]), "false");

  const serialized = JSON.stringify(workflow);
  assert.equal(serialized.includes("secrets"), false);
  assert.equal(serialized.includes("GITHUB_TOKEN"), false);
  assert.equal(serialized.includes("wallet"), false);
  assert.equal(serialized.includes("pull_request"), false);
  assert.equal(serialized.includes("\"write\""), false);
  assert.equal(/schedule|cron/i.test(serialized), false);
});
