// GET /v1/screenshot?url=&format=png|jpeg|pdf&device=&full_page= — x402-paid,
// synchronous over the browser job queue: the request enqueues a screenshot
// job, waits for the worker, and returns the binary directly. Payment settles
// only on a 200 with bytes; timeouts/failures return >=400 and never settle.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { validateTarget } from "../../../lib/safe-fetch.js";
import { normalizeScreenshotRequest } from "../../../lib/screenshot.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { getStore } from "../../../lib/deep/store.js";
import { hasWorkerCapacity } from "../../../lib/deep/capacity.js";
import { deepAuditGate, NO_STORE } from "../../../lib/deep/gate.js";
import { newJobId } from "../../../lib/deep/ids.js";
import { notifyTransaction } from "../../../notify.js";

export const maxDuration = 60;

const PRICE = process.env.SCREENSHOT_PRICE_USDC ?? "0.01";
const WAIT_DEADLINE_MS = 50000;
const POLL_MS = 1500;

async function handler(req) {
  let request;
  try {
    // Validation runs AFTER the paywall so unpaid probes get the 402 challenge.
    request = normalizeScreenshotRequest({
      url: req.nextUrl.searchParams.get("url") ?? "",
      format: req.nextUrl.searchParams.get("format") ?? undefined,
      device: req.nextUrl.searchParams.get("device") ?? undefined,
      full_page: req.nextUrl.searchParams.get("full_page") ?? undefined,
    });
    validateTarget(request.url);
  } catch (error) {
    return auditErrorResponse(error);
  }

  try {
    if (!(await hasWorkerCapacity())) {
      return NextResponse.json(
        { error: "No render worker is online right now (you have not been charged). Retry shortly.", code: "SERVICE_UNAVAILABLE" },
        { status: 503, headers: { ...NO_STORE, "Retry-After": "120" } }
      );
    }

    const store = getStore();
    const id = newJobId();
    await store.createJob({
      id, request,
      requestHash: id, // sync one-shot: no idempotent replay surface
      idemHash: null, priceAtomic: null, network: NETWORK,
    });

    const deadline = Date.now() + WAIT_DEADLINE_MS;
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const job = await store.getJob(id);
      if (!job || Date.now() > deadline) {
        await store.cancelJob(id).catch(() => {});
        return NextResponse.json(
          { error: "Render did not finish in time (you have not been charged). Retry shortly — a cold worker may still be waking.", code: "RENDER_TIMEOUT" },
          { status: 504, headers: NO_STORE }
        );
      }
      if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
        return NextResponse.json(
          { error: job.error_message ?? "Render failed (you have not been charged).", code: job.error_code ?? "RENDER_FAILED" },
          { status: 502, headers: NO_STORE }
        );
      }
      if (job.status === "completed") break;
    }

    const [meta] = await store.listArtifacts(id);
    const artifact = meta && (await store.getArtifact(meta.id));
    if (!artifact?.data) {
      return NextResponse.json({ error: "Render artifact missing (you have not been charged).", code: "RENDER_FAILED" }, { status: 502, headers: NO_STORE });
    }
    return new NextResponse(Buffer.from(artifact.data), {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": artifact.content_type,
        "Content-Disposition": `inline; filename="screenshot-${id}.${request.format === "jpeg" ? "jpg" : request.format}"`,
        "X-Render-Job": id,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("screenshot render failed:", error.message);
    return NextResponse.json({ error: "Render failed (you have not been charged).", code: "RENDER_FAILED" }, { status: 502, headers: NO_STORE });
  }
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Render one public page in a real isolated Chromium browser and get the image or PDF bytes back synchronously: format png (default), jpeg, or pdf; device desktop (default) or mobile; full_page=true for the whole page. SSRF-guarded browsing with request and byte budgets. Payment settles only when bytes are returned — timeouts and failures are free.",
  mimeType: "image/png",
  serviceName: "Santos Screenshot & PDF Render",
  tags: ["screenshot", "pdf-render", "browser", "headless-chrome", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms, sign, and retry with a PAYMENT-SIGNATURE header. Payment settles only when render bytes are returned. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      input: { url: "https://example.com", format: "png", device: "desktop", full_page: false },
      inputSchema: {
        properties: {
          url: { type: "string", description: "Public HTTP or HTTPS page to render." },
          format: { type: "string", enum: ["png", "jpeg", "pdf"] },
          device: { type: "string", enum: ["desktop", "mobile"] },
          full_page: { type: "boolean" },
        },
        required: ["url"],
      },
      output: { example: { note: "Binary response: image/png, image/jpeg, or application/pdf bytes with an X-Render-Job header." } },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/v1/screenshot": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

export async function GET(req) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const res = await paidHandler(req);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Render-Job");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() =>
        notifyTransaction({
          url: "screenshot render",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode screenshot settlement receipt:", e.message);
    }
  }
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Render-Job",
      "Access-Control-Max-Age": "86400",
    },
  });
}
