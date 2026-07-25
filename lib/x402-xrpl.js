// XRPL (XRP) support for the shared x402 v2 resource server: an exact-scheme
// SchemeNetworkServer implementation plus a live XRP/USD oracle so the XRP
// option always equals the route's USD price. Settles through t54's public
// XRPL x402 facilitator (https://xrpl-x402.t54.ai) using payer-signed XRPL
// Payment transactions. Opt-in: the rail is disabled unless XRPL_PAY_TO is set.
import { HTTPFacilitatorClient } from "@x402/core/server";

// XRPL mainnet in CAIP-2 form (network id 0 = mainnet, 1 = testnet).
export const XRPL_NETWORK = "xrpl:0";

export const XRPL_FACILITATOR_URL =
  process.env.XRPL_FACILITATOR_URL ?? "https://xrpl-facilitator-mainnet.t54.ai";

// Static fallback rate, used only when every live oracle is unreachable and no
// cached rate exists. Bump this if the rail must survive a long oracle outage.
const FALLBACK_XRP_USD_PRICE = 1.15;

const ORACLE_TTL_MS = 60_000;
const ORACLE_TIMEOUT_MS = 3_000;
const DROPS_PER_XRP = 1_000_000n;

export const XRPL_PAY_TO = process.env.XRPL_PAY_TO ?? "";

// Classic XRPL addresses start with 'r' and are 25-35 base58 chars.
const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

export function xrplEnabled() {
  if (!XRPL_PAY_TO) return false;
  if (!XRPL_ADDRESS_RE.test(XRPL_PAY_TO)) {
    console.warn(
      "x402 XRPL: XRPL_PAY_TO does not look like a classic XRPL address — XRP payment option disabled.",
    );
    return false;
  }
  return true;
}

// --- Live XRP/USD oracle ---------------------------------------------------
// Cached for 60s so a burst of 402 challenges costs at most one outbound call.
// Never throws: a broken oracle must never break the payment challenge (which
// also carries the USDC option).
let cachedRate = null;
let cachedAt = 0;

async function fetchJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ORACLE_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`oracle ${url} returned ${res.status}`);
  return res.json();
}

async function queryOracles() {
  try {
    const data = await fetchJson("https://api.coinbase.com/v2/prices/XRP-USD/spot");
    const rate = Number(data?.data?.amount);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // fall through to next oracle
  }
  try {
    const data = await fetchJson(
      "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd",
    );
    const rate = Number(data?.ripple?.usd);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // fall through to fallback
  }
  return null;
}

export async function getXrpUsdPrice() {
  if (cachedRate !== null && Date.now() - cachedAt < ORACLE_TTL_MS) {
    return cachedRate;
  }
  const rate = await queryOracles();
  if (rate !== null) {
    cachedRate = rate;
    cachedAt = Date.now();
    return rate;
  }
  if (cachedRate !== null) return cachedRate; // stale cache beats the guess
  const fallback = Number(process.env.XRP_USD_PRICE);
  return Number.isFinite(fallback) && fallback > 0
    ? fallback
    : FALLBACK_XRP_USD_PRICE;
}

// Test hook: reset the oracle cache so tests can control fetch responses.
export function _resetXrpPriceCache() {
  cachedRate = null;
  cachedAt = 0;
}

// "$0.015" / "0.015" / 0.015 -> 0.015, or null when not a USD price.
function parseUsdPrice(price) {
  if (typeof price === "number") return Number.isFinite(price) && price > 0 ? price : null;
  if (typeof price !== "string") return null;
  const match = price.trim().match(/^\$?(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const usd = Number(match[1]);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

export async function usdToXrpDrops(usd) {
  const rate = await getXrpUsdPrice();
  // BigInt math on scaled integers: ceil(usd * 1e12 / (rate * 1e6)).
  const scaledUsd = BigInt(Math.round(usd * 1e12));
  const scaledRate = BigInt(Math.round(rate * 1e6));
  const drops = (scaledUsd + scaledRate - 1n) / scaledRate;
  return drops.toString();
}

// --- XRPL facilitator client ------------------------------------------------
// t54's facilitator speaks the standard x402 facilitator HTTP API, so the
// stock HTTPFacilitatorClient handles verify/settle. The one customization:
// if /supported is unreachable at server init, advertise the exact/xrpl:0
// kind from config instead of failing. Without this, a t54 outage at cold
// start would leave no supported kind for xrpl:0, and the resource server
// would throw while building EVERY route's payment requirements — breaking
// the USDC rail too. With it, a t54 outage only fails XRP verify/settle
// attempts; USDC buyers are unaffected.
export class XrplFacilitatorClient extends HTTPFacilitatorClient {
  constructor(url = XRPL_FACILITATOR_URL) {
    super({ url });
  }

  async getSupported() {
    try {
      return await super.getSupported();
    } catch (e) {
      console.warn(`x402 XRPL: facilitator /supported unreachable (${e.message}); advertising exact/${XRPL_NETWORK} from config.`);
      return {
        kinds: [{ x402Version: 2, scheme: "exact", network: XRPL_NETWORK }],
        extensions: [],
      };
    }
  }
}

// --- exact scheme, XRPL network --------------------------------------------
// Implements @x402/core's SchemeNetworkServer so the shared resourceServer can
// build XRPL payment requirements per request. parsePrice receives the same
// "$0.015" USD string the route advertises for USDC and converts it to drops
// at the live rate, keeping the two rails priced identically.
export class ExactXrplScheme {
  scheme = "exact";

  async parsePrice(price, network) {
    if (network !== XRPL_NETWORK) {
      throw new Error(`ExactXrplScheme only supports ${XRPL_NETWORK}, got ${network}`);
    }
    // Already atomic: { amount: "<drops>", asset: "XRP" }.
    if (price && typeof price === "object" && price.amount !== undefined) {
      return { amount: String(price.amount), asset: price.asset ?? "XRP" };
    }
    const usd = parseUsdPrice(price);
    if (usd === null) {
      throw new Error(`ExactXrplScheme cannot parse price: ${JSON.stringify(price)}`);
    }
    return { amount: await usdToXrpDrops(usd), asset: "XRP" };
  }

  // 1 XRP = 1,000,000 drops — same precision as USDC.
  getAssetDecimals() {
    return 6;
  }

  async enhancePaymentRequirements(paymentRequirements) {
    return {
      ...paymentRequirements,
      maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds ?? 300,
    };
  }
}
