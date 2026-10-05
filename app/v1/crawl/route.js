import { withAgentLog } from "../../../lib/agent-log.js";
import { requireSecret } from "../../../lib/required-env.js";
// POST /v1/crawl — create a site crawl (url) or bulk page job (urls | template).
//
// Payment contract (x402 "upto"): the buyer authorizes up to budget_usdc. This
// route only VERIFIES that authorization and stores it; nothing is charged
// here. lib/crawl/settle.js charges the actual cost once, after the job
// completes. So unlike the exact-scheme routes, there is no settlement on the
// response and no PAYMENT-RESPONSE header.
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { parseCreateRequest, PAYMENT_CONTRACT, LIMITS, PRICES } from "../../../lib/crawl/schemas.js";
import { jobView } from "../../../lib/crawl/view.js";
import { getStore, DuplicateAuthorizationError } from "../../../lib/crawl/store.js";
import { buildCrawlHttpServer, requestContext, authorizationDetails, AUTH_WINDOW_SECONDS } from "../../../lib/crawl/x402.js";
import { crawlGate } from "../../../lib/crawl/gate.js";
import { newCrawlJobId, accessTokenFor } from "../../../lib/deep/ids.js";
import { NO_STORE } from "../../../lib/deep/gate.js";
import { hasWorkerCapacity } from "../../../lib/deep/capacity.js";
import { x402EnvCheck } from "../../../lib/x402-env-check.js";
import { NETWORK } from "../../../lib/x402-server.js";

const IDEM_SECRET = requireSecret("IDEMPOTENCY_HASH_SECRET", "dev-only-idem-secret");
// An authorization this close to its deadline can't cover queue + crawl + settle.
const MIN_AUTH_REMAINING_MS = Number(process.env.CRAWL_MIN_AUTH_REMAINING_SECONDS ?? 3600) * 1000;

const EXPOSE = "PAYMENT-REQUIRED, PAYMENT-RESPONSE";

const json = (body, status, extra = {}) => NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });

const routeConfig = {
  // Keep under CDP's ~500-char resource.description verify limit (x402#2284).
  description:
    "Crawl one website (same-origin, robots.txt respected) or process a bulk list of same-origin pages, storing each page and returning a manifest with signed download URLs. Pay-per-page via x402 upto: authorize up to budget_usdc; nothing is charged at creation, and only pages actually processed are charged after the job completes.",
  mimeType: "application/json",
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2 'upto' scheme: decode the base64 PAYMENT-REQUIRED header, sign a Permit2 authorization for at most your budget_usdc (send budget_usdc in the JSON body; the challenge quotes it), and retry with PAYMENT-SIGNATURE. Nothing is charged until the job completes; you pay ${PRICES.pageUsdc} USDC per page (${PRICES.renderedPageUsdc} rendered), capped at budget_usdc.`,
    },
  }),
};

const httpServer = buildCrawlHttpServer(routeConfig);
let initPromise = null;
const initHttpServer = () => (initPromise ??= httpServer.initialize().catch((e) => { initPromise = null; throw e; }));

function paymentErrorResponse(instructions) {
  const headers = new Headers(instructions.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", EXPOSE);
  return new NextResponse(JSON.stringify(instructions.body ?? {}), { status: instructions.status, headers });
}

async function createJob(req, body, verified) {
  // Validation runs AFTER the paywall so unpaid discovery probes get the 402
  // challenge. Nothing has been charged, so every rejection below is free.
  const { errors, normalized: request } = parseCreateRequest(body);
  if (errors.length) return json({ error: errors.join("; "), code: "INVALID_REQUEST" }, 400);

  if (verified.paymentRequirements.amount !== request.budget_atomic) {
    return json({ error: "The payment authorization amount does not match budget_usdc. Re-sign against the challenge for this exact body.", code: "PAYMENT_MISMATCH" }, 400);
  }
  const auth = authorizationDetails(verified.paymentPayload);
  if (!auth) return json({ error: "Payment payload is not an upto Permit2 authorization.", code: "PAYMENT_MISMATCH" }, 400);
  if (auth.expiresAt.getTime() - Date.now() < MIN_AUTH_REMAINING_MS) {
    return json({ error: `Payment authorization expires too soon; it must stay valid for at least ${MIN_AUTH_REMAINING_MS / 1000}s.`, code: "PAYMENT_MISMATCH" }, 400);
  }

  try {
    if (!(await hasWorkerCapacity())) {
      return json({ error: "No crawl worker is online right now, so new jobs are not being accepted (nothing was charged).", code: "SERVICE_UNAVAILABLE" }, 503, { "Retry-After": "600" });
    }
  } catch (e) {
    console.error("crawl worker liveness check failed:", e.message);
    return json({ error: "Could not verify crawl capacity. Nothing was charged.", code: "SERVICE_UNAVAILABLE" }, 503);
  }

  const store = getStore();
  // Each open job holds an unsettled authorization against the payer's balance;
  // capping them bounds how much work can be done for funds that may not exist.
  if ((await store.countOpenJobsForPayer(auth.payer)) >= LIMITS.maxOpenJobsPerPayer) {
    return json({ error: `This wallet already has ${LIMITS.maxOpenJobsPerPayer} unsettled crawl jobs. Wait for one to finish.`, code: "TOO_MANY_OPEN_JOBS" }, 429, { "Retry-After": "300" });
  }

  const requestHash = createHmac("sha256", IDEM_SECRET).update(JSON.stringify(request)).digest("hex");
  const idemKey = req.headers.get("idempotency-key");
  const idemHash = idemKey ? createHmac("sha256", IDEM_SECRET).update(idemKey).digest("hex") : null;
  const replay = async () => {
    const existing = idemHash && (await store.findByIdempotency(idemHash));
    if (!existing) return null;
    if (existing.request_hash !== requestHash) {
      return json({ error: "Idempotency-Key was already used with a different request body.", code: "IDEMPOTENCY_KEY_REUSED" }, 422);
    }
    return json({ ...jobView(existing), code: "IDEMPOTENT_REPLAY", access_token: accessTokenFor(existing.id), note: "Existing job returned; this authorization was not used." }, 409);
  };
  const replayed = await replay();
  if (replayed) return replayed;

  let job;
  try {
    job = await store.createJob({
      id: newCrawlJobId(), request, requestHash, idemHash, network: NETWORK,
      payer: auth.payer, paymentNonce: auth.nonce, authorizationExpiresAt: auth.expiresAt,
      paymentPayload: verified.paymentPayload, paymentRequirements: verified.paymentRequirements,
    });
  } catch (e) {
    if (e instanceof DuplicateAuthorizationError) return json({ error: e.message, code: e.code }, 409);
    const raced = await replay(); // unique-violation race on idempotency key: another retry won
    if (raced) return raced;
    console.error("crawl job create failed:", e.message);
    return json({ error: "Could not accept the job. Nothing was charged.", code: "SERVICE_UNAVAILABLE" }, 503);
  }

  return json(
    {
      ...jobView(job),
      access_token: accessTokenFor(job.id),
      payment_contract: PAYMENT_CONTRACT,
      authorization_window_seconds: AUTH_WINDOW_SECONDS,
    },
    201
  );
}

async function handlePOST(req) {
  const gate = crawlGate();
  if (gate) return gate;
  const missingEnv = x402EnvCheck();
  if (missingEnv.length) {
    return json({ error: "x402 facilitator credentials are not configured for this deployment.", code: "SERVICE_UNAVAILABLE", missing: missingEnv }, 503);
  }

  // Parsed once: the quoted price is read from it, possibly more than once.
  const body = await req.json().catch(() => undefined);

  try {
    await initHttpServer();
  } catch (e) {
    console.error("crawl x402 init failed:", e.message);
    return json({ error: "Payment facilitator unavailable. Nothing was charged.", code: "SERVICE_UNAVAILABLE" }, 503);
  }

  const result = await httpServer.processHTTPRequest(requestContext(req, body));
  if (result.type === "payment-error") return paymentErrorResponse(result.response);
  if (result.type !== "payment-verified") {
    return json({ error: "Payment configuration error.", code: "SERVICE_UNAVAILABLE" }, 503);
  }

  let res;
  try {
    res = await createJob(req, body, result);
  } catch (error) {
    await result.cancellationDispatcher.cancel({ reason: "handler_threw", error });
    throw error;
  }
  if (res.status !== 201) await result.cancellationDispatcher.cancel({ reason: "handler_failed" });
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", EXPOSE);
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE, Idempotency-Key, Authorization",
      "Access-Control-Expose-Headers": EXPOSE,
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withAgentLog(handlePOST, "crawl");
