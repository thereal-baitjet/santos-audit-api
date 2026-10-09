import { withAgentLog } from "../../../../lib/agent-log.js";
// POST /api/audit/remediate — generate fixes for failed AI Readiness layers.
//
// Body: { domain, siteDescription, failedLayers[], existingEndpoints[], report? }
// Returns a publish-ready llms.txt (discoverable/callable) and an Organization
// JSON-LD <script> (understandable). Generation is pure — the target domain is
// never fetched — so the only resource to bound is the request body itself.
//
// Access, in order:
//   1. report: a signed, never-published /api/agent-readiness report for the
//      same domain → free, up to REPORT_FREE_USES times per report.
//   2. otherwise x402: $REMEDIATE_PRICE_USDC (default 0.02), settled only on a
//      successful response.
//
// Dark until REMEDIATE_ENABLED=true, same launch pattern as /v1/fix-it: the
// price isn't in lib/products.js, llms.txt, OpenAPI or the Bazaar catalog yet,
// so it must not be reachable or indexable before launch.
import { after, NextResponse, type NextRequest } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import type { RouteConfig } from "@x402/core/server";
import { RemediationError, buildRemediation, parseRemediateRequest } from "../../../../lib/remediate.ts";
import { REPORT_ALLOWANCE_TTL_SECS, REPORT_FREE_USES, assertReportUnpublished, checkReportForSite } from "../../../../lib/remediate-report.ts";
import { claimSlot } from "../../../../lib/demo-limit.js";
import { resourceServer, SELLER, NETWORK } from "../../../../lib/x402-server.js";
import { notifyTransaction } from "../../../../notify.js";

export const dynamic = "force-dynamic";

const PRICE = process.env.REMEDIATE_PRICE_USDC ?? "0.02";
// Large enough for a full signed Agent Readiness report alongside the request.
const MAX_BODY_BYTES = 1_000_000;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  "Cache-Control": "no-store",
} as const;

type BodyResult = { ok: true; value: unknown } | { ok: false; error: RemediationError };

/** Read and parse a JSON body, never buffering more than MAX_BODY_BYTES. */
async function readJsonBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) {
    throw new RemediationError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const tooLarge = () =>
    new RemediationError("PAYLOAD_TOO_LARGE", `Request body must be at most ${MAX_BODY_BYTES} bytes.`);

  // Content-Length is a cheap early reject; the streaming cap below is the
  // real bound, since chunked requests carry no length at all.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw tooLarge();
  if (!req.body) throw new RemediationError("INVALID_JSON", "Request body is empty.");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const text = new TextDecoder().decode(Buffer.concat(chunks));
  if (!text.trim()) throw new RemediationError("INVALID_JSON", "Request body is empty.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RemediationError("INVALID_JSON", "Request body is not valid JSON.");
  }
}

function errorResponse(e: unknown): NextResponse {
  if (e instanceof RemediationError) {
    return NextResponse.json(
      { error: e.message, code: e.code, ...(e.details.length ? { details: e.details } : {}) },
      { status: e.status, headers: HEADERS }
    );
  }
  console.error("[remediate] unexpected failure", e);
  return NextResponse.json(
    { error: "Remediation generation failed unexpectedly.", code: "INTERNAL_ERROR" },
    { status: 500, headers: HEADERS }
  );
}

function generate(body: unknown, access: { mode: "report" | "x402" }): NextResponse {
  const { request, site } = parseRemediateRequest(body);
  return NextResponse.json({ ...buildRemediation(request, site), access }, { headers: HEADERS });
}

// The body is read once, before the paywall decides anything, and handed to
// the paid handler here: x402 passes the same Request object through, and a
// consumed body cannot be read twice.
const bodies = new WeakMap<Request, BodyResult>();

async function paidHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = bodies.get(req);
    if (!body) throw new Error("request body was not pre-read");
    if (!body.ok) throw body.error;
    // Validation runs AFTER the paywall so unpaid discovery probes get the 402
    // challenge; a paid-but-invalid request 400s here and never settles.
    return generate(body.value, { mode: "x402" });
  } catch (e) {
    return errorResponse(e);
  }
}

const config: RouteConfig = {
  // NETWORK comes from untyped JS; it is the CAIP-2 id "eip155:8453".
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK as `${string}:${string}`, payTo: SELLER },
  description:
    "AI Readiness remediation: from a domain, a one-line site description, the failed layers, and the site's endpoints, returns a publish-ready llms.txt (Discoverable/Callable) and an Organization JSON-LD script (Understandable). Pure generation, the target is never fetched. Free with a signed, unpublished /api/agent-readiness report for the same domain. Payment settles only on a successful response.",
  mimeType: "application/json",
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Or include "report": a signed, unpublished /api/agent-readiness report for the same domain to remediate for free (${REPORT_FREE_USES} uses per report).`,
    },
  }),
};

// Verbless route key so the paywall applies whatever the method.
const httpServer = new x402HTTPResourceServer(resourceServer, { "/api/audit/remediate": config });
const paid = withX402FromHTTPServer(paidHandler, httpServer);

async function viaReport(body: Record<string, unknown>): Promise<NextResponse> {
  try {
    // Validate the request first so a malformed call never spends an allowance.
    const { site } = parseRemediateRequest(body);
    const grant = checkReportForSite(body.report, site);
    await assertReportUnpublished(body.report);
    const claimed = await claimSlot(`remediate:report:${grant.signature}:`, REPORT_FREE_USES, REPORT_ALLOWANCE_TTL_SECS);
    if (!claimed) {
      throw new RemediationError(
        "REPORT_ALLOWANCE_USED",
        `This report's ${REPORT_FREE_USES} free remediations are used. Omit "report" to pay $${PRICE} USDC via x402, or run a new /api/agent-readiness audit.`
      );
    }
    return generate(body, { mode: "report" });
  } catch (e) {
    return errorResponse(e);
  }
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (process.env.REMEDIATE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Remediation is not enabled on this deployment yet. /api/agent-readiness remains available.", code: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: HEADERS }
    );
  }

  let body: BodyResult;
  try {
    body = { ok: true, value: await readJsonBody(req) };
  } catch (e) {
    if (!(e instanceof RemediationError)) return errorResponse(e);
    body = { ok: false, error: e };
  }

  if (body.ok && typeof body.value === "object" && body.value !== null && "report" in body.value) {
    return viaReport(body.value as Record<string, unknown>);
  }

  bodies.set(req, body);
  const res = await paid(req);
  for (const [key, value] of Object.entries(HEADERS)) res.headers.set(key, value);
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() =>
        notifyTransaction({
          url: "remediation",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode remediate settlement receipt:", (e as Error).message);
    }
  }
  return res;
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...HEADERS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withAgentLog(handle, "remediate");
