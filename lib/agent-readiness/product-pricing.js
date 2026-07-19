export const DEFAULT_AGENT_READINESS_PRICE_USDC = "0.075";
export const AGENT_READINESS_BILLING_UNIT = "successful audit";

export function getAgentReadinessPriceUsdc() {
  const configured = process.env.AGENT_READINESS_PRICE_USDC?.trim();
  const price = configured || DEFAULT_AGENT_READINESS_PRICE_USDC;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(price) || BigInt(usdcAtomicAmount(price)) <= 0n) {
    throw new Error("AGENT_READINESS_PRICE_USDC must be a positive USDC amount with at most six decimal places");
  }
  return normalizePrice(price);
}

export function usdcAtomicAmount(price = getAgentReadinessPriceUsdc()) {
  const [whole, fraction = ""] = String(price).split(".");
  return BigInt(`${whole}${fraction.padEnd(6, "0")}`).toString();
}

function normalizePrice(price) {
  const [whole, fraction = ""] = price.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${BigInt(whole)}.${trimmedFraction}` : BigInt(whole).toString();
}
