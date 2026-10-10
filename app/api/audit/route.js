import { withAgentLog } from "../../../lib/agent-log.js";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { auditSite } from "../../../audit.js";
import { notifyTransaction } from "../../../notify.js";
import { auditErrorResponse, CORS } from "../../../lib/errors.js";
import { resourceServer, SELLER, NETWORK } from "../../../lib/x402-server.js";
import { bazaarResourceMeta } from "../../../lib/bazaar-catalog.js";
import { recordEvent } from "../../../lib/analytics-store.js";
import { signReport } from "../../../lib/report-signing.js";
import { upsertPublicReport } from "../../../lib/public-reports.js";
import { applyPublicListingHeader, publicListingHeader, wantsPublicListing } from "../../../lib/public-listing.js";
import { timedStage, TimingTracker } from "../../../lib/timing.js";

async function handler(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const isPublic = wantsPublicListing(req.nextUrl.searchParams);
  let listing = "not-requested";
  const timing = req.timing;

  try {
    const report = await timedStage(timing, 'audit', () => auditSite(url));

    const signed = await timedStage(timing, 'sign', () =>
      Promise.resolve(signReport({ tier: "paid", ...report }))
    );

    // Opt-in public listing. Fail-soft: a listing failure never breaks a
    // paid response, and only the report JSON is stored — never the payer.
    if (isPublic) {
      try {
        await timedStage(timing, 'public_listing', () =>
          upsertPublicReport({
            url: report.url,
            score: report.website_intelligence_score ?? report.overall_score ?? null,
            report: signed,
            source: "quick-paid",
          })
        );
        listing = "listed";
      } catch (e) {
        console.warn("public report upsert failed:", e.message);
        listing = "failed";
      }
    }

    const response = NextResponse.json(signed, { headers: CORS });
    applyPublicListingHeader(response, publicListingHeader(listing, report.url));
    timing.addHeaders(response);
    return response;
  } catch (e) {
    // withX402 only settles payment for responses under 400, so a failed
    // audit here costs the agent nothing.
    const response = auditErrorResponse(e);
    timing.addHeaders(response);
    return response;
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
    ...bazaarResourceMeta("quick-audit"),
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

// Add cache-control configuration
// Public reports can be cached, but payment exchanges must never be cached
const CACHE_CONTROL_PAID = 'no-store'; // paid responses must never be CDN-cached: a cached 200 is served to unpaid callers
const CACHE_CONTROL_UNPAID = 'no-store'; // Never cache payment challenges

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, PAYMENT-SIGNATURE",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Santos-Public-Listing",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleGET(req) {
  // Initialize timing tracker for this request
  const timing = new TimingTracker();
  req.timing = timing;

  timing.mark('x402');
  const res = await paidHandler(req);
  timing.end('x402');

  // Browser agents must be able to read the challenge and receipt headers,
  // and payment exchanges must never be cached.
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Response-Time, X-Stage-Timings, X-Santos-Public-Listing");

  // Cache control: successful audits can be cached for 1 hour at edge
  // Payment challenges must never be cached
  if (res.status < 400 && res.headers.get("PAYMENT-RESPONSE")) {
    res.headers.set("Cache-Control", CACHE_CONTROL_PAID);
  } else {
    res.headers.set("Cache-Control", CACHE_CONTROL_UNPAID);
  }

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
