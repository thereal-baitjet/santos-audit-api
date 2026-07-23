import { withAgentLog } from "../../../lib/agent-log.js";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { auditSite } from "../../../audit.js";
import { notifyTransaction } from "../../../notify.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { recordEvent } from "../../../lib/analytics-store.js";
import { signReport } from "../../../lib/report-signing.js";
import { upsertPublicReport } from "../../../lib/public-reports.js";

async function handler(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const isPublic = req.nextUrl.searchParams.get("public") === "1";
  try {
    const report = await auditSite(url);
    const signed = signReport({ tier: "paid", ...report });
    // Opt-in public listing. Fail-soft: a listing failure never breaks a
    // paid response, and only the report JSON is stored — never the payer.
    if (isPublic) {
      try {
        await upsertPublicReport({
          url: report.url,
          score: report.website_intelligence_score ?? report.overall_score ?? null,
          report: signed,
          source: "quick-paid",
        });
      } catch (e) {
        console.warn("public report upsert failed:", e.message);
      }
    }
    return NextResponse.json(signed, { headers: CORS });
  } catch (e) {
    // withX402 only settles payment for responses under 400, so a failed
    // audit here costs the agent nothing.
    return auditErrorResponse(e);
  }
}

const routeConfig = {
    accepts: {
      scheme: "exact",
      price: "$0.015",
      network: NETWORK,
      payTo: SELLER,
    },
    description:
      "Run a fast, lightweight audit of a single public web page: performance signals (fetch timing, page weight), SEO signals, basic HTML accessibility signals, and security-header checks. Returns 0-100 category scores, detailed pass/fail checks, detected issues, and plain-English remediation guidance.",
    mimeType: "application/json",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        hint: "x402 v2: decode the base64 PAYMENT-REQUIRED response header for full terms ($0.015 USDC on eip155:8453), sign, and retry with a PAYMENT-SIGNATURE header. Any x402 v2 client (e.g. @x402/fetch) automates this. Docs: /llms.txt and /openapi.json.",
      },
    }),
    serviceName: "Santos Quick Intelligence Audit",
    tags: ["website-audit", "seo", "accessibility", "security", "performance"],
    extensions: {
      ...declareDiscoveryExtension({
        input: { url: "https://example.com" },
        inputSchema: {
          properties: {
            url: { type: "string", description: "The public HTTP or HTTPS website URL to audit." },
          },
          required: ["url"],
        },
        output: {
          example: {
            tier: "paid",
            url: "https://example.com/",
            http_status: 200,
            overall_score: 68,
            scores: { performance: 100, seo: 40, accessibility: 100, security: 33 },
            issues: ["Missing canonical link", "Missing Content-Security-Policy header"],
          },
        },
      }),
    },
};

// Verbless route key: parseRoutePattern would scope a "VERB /path" key to that
// verb only, and Next.js serves HEAD through the GET handler — a verb-scoped
// route would let HEAD probes reach the audit unpaid.
const httpServer = new x402HTTPResourceServer(resourceServer, {
  "/api/audit": routeConfig,
});
const paidHandler = withX402FromHTTPServer(handler, httpServer);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleGET(req) {
  const res = await paidHandler(req);
  // Browser agents must be able to read the challenge and receipt headers,
  // and payment exchanges must never be cached.
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");
  res.headers.set("Cache-Control", "no-store");
  const receipt = res.headers.get("PAYMENT-RESPONSE");
  if (receipt && res.status < 400) {
    try {
      const settlement = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
      // Funnel bottom for the x402 path (fails open, never blocks the response).
      after(() => recordEvent({ event: "payment_completed", props: { rail: "x402", amount_usd: 0.015 } }));
      after(() =>
        notifyTransaction({
          url: req.nextUrl.searchParams.get("url") ?? "",
          payer: settlement.payer,
          transaction: settlement.transaction,
          network: settlement.network,
          amount: "0.015",
        })
      );
    } catch (e) {
      console.error("Could not decode settlement receipt for notification:", e.message);
    }
  }
  return res;
}

export const GET = withAgentLog(handleGET, "quick-audit");
