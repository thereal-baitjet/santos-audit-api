// POST /v1/audits — create a Deep Page Audit job.
//
// Payment contract (x402 v2, $DEEP_AUDIT_PRICE_USDC): the payment purchases a
// bounded compute reservation. It settles when the job is ACCEPTED (201) —
// not when the report completes. Validation failures, idempotent replays, and
// service errors return >=400 and therefore do not settle.
import { after, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { validateTarget, AuditError } from "../../../lib/safe-fetch.js";
import { validateCreateRequest, normalizeCreateRequest, PAYMENT_CONTRACT, MODULES, DEVICES } from "../../../lib/deep/schemas.js";
import { getStore } from "../../../lib/deep/store.js";
import { newJobId, accessTokenFor } from "../../../lib/deep/ids.js";
import { deepAuditGate, NO_STORE } from "../../../lib/deep/gate.js";
import { PUBLIC_API_BASE_URL } from "../../../lib/base-url.js";
import { notifyTransaction } from "../../../notify.js";
import { x402EnvCheck } from "../../../lib/x402-env-check.js";
import { hasWorkerCapacity } from "../../../lib/deep/capacity.js";

const PRICE = `$${process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225"}`;
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
  // Worker capacity runs AFTER the paywall so unpaid discovery probes always
  // see the 402 challenge. Capacity means: a worker heartbeat is fresh, OR the
  // stopped Fly machine can be started right now (wake-per-job). A paid request
  // with neither 503s here, which does not settle (settlement only happens on
  // <400) — nobody is charged for a job nothing would process.
  try {
    if (!(await hasWorkerCapacity())) {
      return NextResponse.json(
        {
          error: "No audit worker is online right now, so new Deep Page Audit jobs are not being accepted (you have not been charged). The Quick Audit at GET /api/audit and Agent Readiness at GET /api/agent-readiness remain available.",
          code: "SERVICE_UNAVAILABLE",
        },
        { status: 503, headers: { ...NO_STORE, "Retry-After": "600" } }
      );
    }
  } catch (e) {
    console.error("worker liveness check failed:", e.message);
    return NextResponse.json(
      { error: "Could not verify audit capacity. No charge was made.", code: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: NO_STORE }
    );
  }

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

const routeConfig = {
    accepts: { scheme: "exact", price: PRICE, network: NETWORK, payTo: SELLER },
    description:
      `Create one Deep Page Audit job with browser-rendered checks and a bounded compute reservation. ${PAYMENT_CONTRACT}`,
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
};

// Verbless route key compiles with verb "*", so every method that reaches
// this handler is paywalled (a "POST /path" key would only match POST).
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/audits": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

export async function POST(req) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const missingEnv = x402EnvCheck();
  if (missingEnv.length) {
    return NextResponse.json(
      { error: "x402 facilitator credentials are not configured for this deployment.", code: "SERVICE_UNAVAILABLE", missing: missingEnv },
      { status: 503, headers: NO_STORE }
    );
  }
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
          amount: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225",
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
