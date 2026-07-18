// POST /v1/audits — create a Deep Page Audit job.
//
// Payment contract (x402 v2, $DEEP_AUDIT_PRICE_USDC): the payment purchases a
// bounded compute reservation. It settles when the job is ACCEPTED (201) —
// not when the report completes. Validation failures, idempotent replays, and
// service errors return >=400 and therefore do not settle.
import { after, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { withX402 } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { validateTarget, AuditError } from "../../../lib/safe-fetch.js";
import { validateCreateRequest, normalizeCreateRequest, PAYMENT_CONTRACT, MODULES, DEVICES } from "../../../lib/deep/schemas.js";
import { getStore } from "../../../lib/deep/store.js";
import { newJobId, accessTokenFor } from "../../../lib/deep/ids.js";
import { deepAuditGate, NO_STORE } from "../../../lib/deep/gate.js";
import { PUBLIC_API_BASE_URL } from "../../../lib/base-url.js";
import { notifyTransaction } from "../../../notify.js";

const PRICE = `$${process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075"}`;
const IDEM_SECRET = process.env.IDEMPOTENCY_HASH_SECRET ?? "dev-only-idem-secret";

const jobLinks = (id) => ({
  status_url: `${PUBLIC_API_BASE_URL}/v1/audits/${id}`,
  report_url: `${PUBLIC_API_BASE_URL}/v1/audits/${id}/report`,
  events_url: `${PUBLIC_API_BASE_URL}/v1/audits/${id}/events`,
  artifacts_url: `${PUBLIC_API_BASE_URL}/v1/audits/${id}/artifacts`,
});

export const jobView = (job) => ({
  job_id: job.id,
  status: job.status,
  stage: job.stage,
  progress: job.progress,
  profile: job.request?.profile,
  created_at: job.created_at,
  started_at: job.started_at,
  completed_at: job.completed_at,
  expires_at: job.expires_at,
  error_code: job.error_code ?? undefined,
  error_message: job.error_message ?? undefined,
  ...jobLinks(job.id),
});

async function handler(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON", code: "INVALID_URL" }, { status: 400, headers: NO_STORE });
  }

  const errors = validateCreateRequest(body);
  if (errors.length) {
    return NextResponse.json({ error: errors.join("; "), code: "INVALID_URL" }, { status: 400, headers: NO_STORE });
  }
  try {
    validateTarget(body.url); // SSRF/scheme/port/length precheck — free rejection
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "INVALID_URL";
    return NextResponse.json({ error: e.message, code }, { status: 400, headers: NO_STORE });
  }

  const store = getStore();
  const request = normalizeCreateRequest(body);
  const requestHash = createHmac("sha256", IDEM_SECRET).update(JSON.stringify(request)).digest("hex");

  // Idempotency: same key + same request => the existing job, WITHOUT a second
  // charge (409 is >=400, so withX402 does not settle this response).
  const idemKey = req.headers.get("idempotency-key");
  const idemHash = idemKey ? createHmac("sha256", IDEM_SECRET).update(idemKey).digest("hex") : null;
  if (idemHash) {
    const existing = await store.findByIdempotency(idemHash);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return NextResponse.json(
          { error: "Idempotency-Key was already used with a different request body.", code: "IDEMPOTENCY_KEY_REUSED" },
          { status: 422, headers: NO_STORE }
        );
      }
      return NextResponse.json(
        { ...jobView(existing), code: "IDEMPOTENT_REPLAY", access_token: accessTokenFor(existing.id), note: "Existing job returned; this request was not charged." },
        { status: 409, headers: NO_STORE }
      );
    }
  }

  const id = newJobId();
  let job;
  try {
    job = await store.createJob({ id, request, requestHash, idemHash, priceAtomic: null, network: NETWORK });
  } catch (e) {
    // Unique-violation race on idempotency key: another retry won — replay it.
    if (idemHash) {
      const existing = await store.findByIdempotency(idemHash);
      if (existing) {
        return NextResponse.json(
          { ...jobView(existing), code: "IDEMPOTENT_REPLAY", access_token: accessTokenFor(existing.id), note: "Existing job returned; this request was not charged." },
          { status: 409, headers: NO_STORE }
        );
      }
    }
    console.error("job create failed:", e.message);
    return NextResponse.json({ error: "Could not accept the job.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }

  return NextResponse.json(
    {
      ...jobView(job),
      access_token: accessTokenFor(job.id),
      payment_contract: PAYMENT_CONTRACT,
    },
    { status: 201, headers: NO_STORE }
  );
}

const paidHandler = withX402(
  handler,
  {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: SELLER },
    description:
      `Create one Deep Page Audit job (asynchronous, browser-rendered): real Chromium via Playwright, Lighthouse lab metrics, rendered axe-core accessibility checks, browser network/console evidence, screenshots, and passive security checks against a single public web page. Returns a job_id + access token; poll status_url and fetch report_url when completed (typically tens of seconds to a few minutes). ${PAYMENT_CONTRACT}`,
    mimeType: "application/json",
    serviceName: "Santos Deep Page Audit",
    tags: ["website-audit", "lighthouse", "accessibility", "axe-core", "security-headers", "browser-rendered"],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for full terms (${PRICE} USDC on ${NETWORK}), sign, and retry with a PAYMENT-SIGNATURE header. Payment reserves one bounded audit job; settlement happens when the job is accepted, not on report completion. Docs: /llms.txt and /openapi.json.`,
      },
    }),
    extensions: {
      ...declareDiscoveryExtension({
        bodyType: "json",
        input: { url: "https://example.com", devices: ["mobile"], modules: ["lighthouse", "accessibility", "browser-network", "security-passive"] },
        inputSchema: {
          properties: {
            url: { type: "string", description: "Public HTTP/HTTPS page to audit." },
            devices: { type: "array", items: { type: "string", enum: [...DEVICES] } },
            modules: { type: "array", items: { type: "string", enum: [...MODULES] } },
          },
          required: ["url"],
        },
        output: {
          example: {
            job_id: "aud_0k3x…",
            status: "queued",
            status_url: "https://api.santosautomation.com/v1/audits/aud_0k3x…",
            report_url: "https://api.santosautomation.com/v1/audits/aud_0k3x…/report",
            access_token: "…",
          },
        },
      }),
    },
  },
  resourceServer
);

export async function POST(req) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const res = await paidHandler(req);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.headers.set("Cache-Control", "no-store");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() =>
        notifyTransaction({
          url: "deep-page audit job",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075",
        })
      );
    } catch (e) {
      console.error("Could not decode settlement receipt:", e.message);
    }
  }
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE, Idempotency-Key, Authorization",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}
