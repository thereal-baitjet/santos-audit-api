// x402 "upto" payment plumbing for /v1/crawl.
//
// Separate from lib/x402-server.js on purpose: existing endpoints stay on the
// exact scheme, untouched. Here the buyer authorizes up to budget_usdc when the
// job is created (verify only); settleCrawlJob() later charges the actual cost.
import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer } from "@x402/core/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { declareEip2612GasSponsoringExtension } from "@x402/extensions";
import { createFacilitatorConfig } from "@coinbase/x402";
import { SELLER, NETWORK } from "../x402-server.js";
import { usdcToAtomic, atomicToUsdc } from "./schemas.js";

// The Permit2 deadline is now + maxTimeoutSeconds. It must outlast queueing,
// the crawl itself, and settlement, or the authorization expires unpaid.
export const AUTH_WINDOW_SECONDS = Number(process.env.CRAWL_AUTH_WINDOW_SECONDS ?? 6 * 3600);
export const DEFAULT_QUOTE_USDC = "1";

// CDP rejects the echoed extensions envelope (see lib/x402-server.js), but the
// EIP-2612 gas-sponsoring extension carries the buyer's one-time Permit2
// approval, so it must survive or first-time buyers can't pay.
const KEEP_EXTENSIONS = ["eip2612GasSponsoring"];
class CrawlFacilitatorClient extends HTTPFacilitatorClient {
  #sanitize({ extensions, ...payload }) {
    const kept = Object.fromEntries(Object.entries(extensions ?? {}).filter(([k]) => KEEP_EXTENSIONS.includes(k)));
    return Object.keys(kept).length ? { ...payload, extensions: kept } : payload;
  }
  verify(paymentPayload, paymentRequirements) {
    return super.verify(this.#sanitize(paymentPayload), paymentRequirements);
  }
  settle(paymentPayload, paymentRequirements) {
    return super.settle(this.#sanitize(paymentPayload), paymentRequirements);
  }
}

export const crawlResourceServer = new x402ResourceServer(
  new CrawlFacilitatorClient(createFacilitatorConfig(process.env.CDP_API_KEY_ID, process.env.CDP_API_KEY_SECRET))
).register(NETWORK, new UptoEvmScheme());

// x402 HTTP adapter over a standard Request with an already-parsed body.
// Mirrors @x402/next's NextAdapter, which can't be imported outside Next's
// bundler (so lib/crawl stays unit-testable). The price callback may run more
// than once per request, so getBody() must not re-read the consumed stream.
class ParsedBodyAdapter {
  constructor(req, body) {
    this.req = req;
    this.url = new URL(req.url);
    this.parsedBody = body;
  }
  getHeader(name) { return this.req.headers.get(name) || undefined; }
  getMethod() { return this.req.method; }
  getPath() { return this.url.pathname; }
  getUrl() { return this.req.url; }
  getAcceptHeader() { return this.req.headers.get("Accept") || ""; }
  getUserAgent() { return this.req.headers.get("User-Agent") || ""; }
  getQueryParams() {
    const params = {};
    for (const key of new Set(this.url.searchParams.keys())) {
      const all = this.url.searchParams.getAll(key);
      params[key] = all.length === 1 ? all[0] : all;
    }
    return params;
  }
  getQueryParam(name) {
    const all = this.url.searchParams.getAll(name);
    return all.length === 0 ? undefined : all.length === 1 ? all[0] : all;
  }
  async getBody() { return this.parsedBody; }
}

export function requestContext(req, body) {
  const adapter = new ParsedBodyAdapter(req, body);
  return {
    adapter,
    path: adapter.getPath(),
    method: req.method,
    paymentHeader: adapter.getHeader("payment-signature") || adapter.getHeader("x-payment"),
  };
}

/** The max the buyer is asked to authorize: their budget_usdc, or a placeholder quote for bare discovery probes. */
export function quotedBudgetUsdc(body) {
  try {
    return atomicToUsdc(usdcToAtomic(body?.budget_usdc));
  } catch {
    return DEFAULT_QUOTE_USDC;
  }
}

export function buildCrawlHttpServer(routeConfig, server = crawlResourceServer) {
  return new x402HTTPResourceServer(server, {
    "/v1/crawl": {
      ...routeConfig,
      accepts: {
        scheme: "upto",
        price: async (ctx) => `$${quotedBudgetUsdc(await ctx.adapter.getBody())}`,
        network: NETWORK,
        payTo: SELLER,
        maxTimeoutSeconds: AUTH_WINDOW_SECONDS,
      },
      extensions: { ...(routeConfig.extensions ?? {}), ...declareEip2612GasSponsoringExtension() },
    },
  });
}

/** Payer, nonce, and deadline from a verified upto (Permit2) payload. */
export function authorizationDetails(paymentPayload) {
  const auth = paymentPayload?.payload?.permit2Authorization;
  if (!auth?.from || auth.nonce == null || !auth.deadline) return null;
  return {
    payer: String(auth.from).toLowerCase(),
    nonce: String(auth.nonce),
    expiresAt: new Date(Number(auth.deadline) * 1000),
  };
}
