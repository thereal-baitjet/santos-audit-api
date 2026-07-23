import { withAgentLog } from "../../../../lib/agent-log.js";
// POST /api/audit/batch — up to 50 Quick Intelligence Audits for one flat x402
// payment ($0.50 USDC, ~33% under 50 × $0.015 per-call at full capacity).
// The volume rail for agents auditing portfolios, prospect lists, or every
// page of a site.
//
// Settlement matches the suite's "failures are free" rule, adapted to batches:
// payment settles only when at least one audit succeeds; a batch where every
// URL fails returns 502 and never settles. Per-URL failures are reported in
// the results array — one bad target does not sink the batch.
import { after, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { auditSite } from "../../../../audit.js";
import { validateTarget, AuditError } from "../../../../lib/safe-fetch.js";
import { CORS } from "../../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../../lib/x402-server.js";
import { recordEvent } from "../../../../lib/analytics-store.js";
import { notifyTransaction } from "../../../../notify.js";
import { signReport } from "../../../../lib/report-signing.js";

const PRICE = process.env.BATCH_AUDIT_PRICE_USDC ?? "0.50";
const MAX_URLS = 50;
const CONCURRENCY = 8;

// Deep-audit jobs are async; this route is synchronous, so cap total wall time
// (worst case ≈ MAX_URLS × 15s fetch timeout ÷ CONCURRENCY, plus overhead).
export const maxDuration = 300;

// Minimal promise pool: at most CONCURRENCY audits in flight, order preserved.
async function mapPool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

async function auditOne(rawUrl) {
  let url;
  try {
    url = validateTarget(String(rawUrl ?? "")).href;
  } catch (e) {
    return { url: String(rawUrl ?? ""), ok: false, error: { message: e.message, code: e instanceof AuditError ? e.code : "INVALID_URL" } };
  }
  try {
    const report = await auditSite(url);
    // Signed so each item is independently verifiable at POST /v1/verify.
    return { url, ok: true, report: signReport(report) };
  } catch (e) {
    return { url, ok: false, error: { message: e.message, code: e.code ?? "AUDIT_FAILED" } };
  }
}

async function handler(req) {
  // Body validation runs AFTER the paywall so unpaid discovery probes get the
  // 402 challenge; a paid-but-malformed request 400s here and never settles.
  const body = await req.json().catch(() => null);
  const urls = body?.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "Body must be JSON with a non-empty urls array (max 50).", code: "INVALID_REQUEST" },
      { status: 400, headers: CORS }
    );
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `Too many URLs: ${urls.length} supplied, max ${MAX_URLS} per batch. Split larger jobs into multiple batches.`, code: "BATCH_TOO_LARGE" },
      { status: 400, headers: CORS }
    );
  }

  const targets = [...new Set(urls.map((u) => String(u ?? "").trim()).filter(Boolean))];
  const results = await mapPool(targets, CONCURRENCY, auditOne);
  const succeeded = results.filter((r) => r.ok).length;

  if (succeeded === 0) {
    // All failures are free — same promise as the single-audit endpoint.
    return NextResponse.json(
      { error: "Every URL in the batch failed to audit; no charge settled.", code: "AUDIT_FAILED", results },
      { status: 502, headers: CORS }
    );
  }

  return NextResponse.json(
    { tier: "paid", batch_size: targets.length, succeeded, failed: targets.length - succeeded, results },
    { headers: CORS }
  );
}

const routeConfig = {
  accepts: { scheme: "exact", price: `$${PRICE}`, network: NETWORK, payTo: SELLER },
  description:
    "Batch Quick Intelligence Audits: up to 50 public URLs for one flat payment. Each URL gets the full single-page audit (performance, SEO, accessibility markup, security headers, website-intelligence score). Per-URL failures are isolated and reported; payment settles only when at least one audit succeeds.",
  mimeType: "application/json",
  serviceName: "Santos Batch Quick Intelligence Audit",
  tags: ["website-audit", "batch", "bulk", "seo", "accessibility", "security", "x402"],
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: {
      error: "Payment required",
      code: "PAYMENT_REQUIRED",
      hint: `x402 v2: decode the base64 PAYMENT-REQUIRED response header for the $${PRICE} USDC terms (up to ${MAX_URLS} URLs per batch), sign, and retry with a PAYMENT-SIGNATURE header. Settles only when at least one audit succeeds. Docs: /llms.txt and /openapi.json.`,
    },
  }),
  extensions: {
    ...declareDiscoveryExtension({
      bodyType: "json",
      input: { urls: ["https://example.com", "https://example.com/about"] },
      inputSchema: {
        properties: {
          urls: {
            type: "array",
            items: { type: "string", description: "Public HTTP or HTTPS URL to audit." },
            minItems: 1,
            maxItems: MAX_URLS,
            description: `Up to ${MAX_URLS} public URLs; duplicates are removed.`,
          },
        },
        required: ["urls"],
      },
      output: {
        example: {
          tier: "paid",
          batch_size: 2,
          succeeded: 1,
          failed: 1,
          results: [
            { url: "https://example.com/", ok: true, report: { overall_score: 68, scores: { performance: 100, seo: 40, accessibility: 100, security: 33 } } },
            { url: "https://bad-host.invalid", ok: false, error: { message: "Target unreachable", code: "TARGET_UNREACHABLE" } },
          ],
        },
      },
    }),
  },
};

// Verbless route key so Next's HEAD→GET mapping still hits the paywall.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/api/audit/batch": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

async function handlePOST(req) {
  const res = await paidHandler(req);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.headers.set("Cache-Control", "no-store");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      after(() => recordEvent({ event: "payment_completed", props: { rail: "x402", amount_usd: Number(PRICE) } }));
      after(() =>
        notifyTransaction({
          url: "batch quick audit",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: PRICE,
        })
      );
    } catch (e) {
      console.error("Could not decode batch settlement receipt:", e.message);
    }
  }
  return res;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const POST = withAgentLog(handlePOST, "batch-audit");
