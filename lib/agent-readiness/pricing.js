const CURRENCIES = "USDC|USD|EUR|GBP|JPY|CAD|AUD|DAI|USDT|ETH|SOL";
const USDC_ASSETS = new Set([
  // Base mainnet and Base Sepolia native USDC contracts.
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
]);

export function extractTextPricingClaims(text, source, sourceUrl) {
  if (typeof text !== "string" || !text.trim()) return [];
  const matches = [];
  const patterns = [
    new RegExp(`\\$\\s*(\\d+(?:\\.\\d+)?)\\s*(${CURRENCIES})?\\b`, "gi"),
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${CURRENCIES})\\b`, "gi"),
  ];
  const seenOffsets = new Set();

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (seenOffsets.has(match.index)) continue;
      seenOffsets.add(match.index);
      const context = text.slice(Math.max(0, match.index - 220), Math.min(text.length, match.index + match[0].length + 220));
      matches.push(compactClaim({
        source,
        source_url: sourceUrl,
        amount: normalizeDecimal(match[1]),
        currency: normalizeCurrency(match[2] ?? "USD"),
        billing_unit: inferBillingUnit(context),
        network: inferNetwork(context),
        protocol: /x402(?:\s+v?2|[- ]v?2)?/i.test(context) ? (/x402\s+v?2|x402[- ]v?2/i.test(context) ? "x402-v2" : "x402") : null,
        resource_url: inferResourceUrl(context, sourceUrl),
      }));
    }
  }
  if (/\b(x402|machine[- ]payable|pay per (?:call|request)|micropayment|usdc)\b/i.test(text)) {
    const currency = /\bUSDC\b/i.test(text) ? "USDC" : null;
    const metadataClaim = compactClaim({
      source,
      source_url: sourceUrl,
      currency,
      billing_unit: inferBillingUnit(text),
      network: inferNetwork(text),
      protocol: inferProtocol(text),
      resource_url: inferResourceUrl(text, sourceUrl),
    });
    if (hasPricingValue(metadataClaim)) matches.push(metadataClaim);
  }
  return dedupeClaims(matches).slice(0, 30);
}

export function extractJsonLdPricingClaims(documents, sourceUrl) {
  const claims = [];
  for (const document of documents ?? []) {
    walk(document, (node) => {
      const types = array(node?.["@type"]).map(String);
      const specification = object(node?.priceSpecification);
      const hasOfferShape = types.includes("Offer") || node?.price != null || node?.priceCurrency != null || specification?.price != null;
      if (!hasOfferShape) return;
      const offered = object(node?.itemOffered);
      claims.push(compactClaim({
        source: "json_ld",
        source_url: sourceUrl,
        amount: normalizeDecimal(node?.price ?? specification?.price),
        currency: normalizeCurrency(node?.priceCurrency ?? specification?.priceCurrency),
        billing_unit: normalizeBillingUnit(specification?.unitText ?? node?.unitText ?? node?.billingIncrement),
        resource_url: absoluteUrl(node?.url ?? offered?.url, sourceUrl),
        protocol: inferProtocol(`${node?.paymentMethod ?? ""} ${node?.description ?? ""}`),
        network: inferNetwork(`${node?.paymentMethod ?? ""} ${node?.description ?? ""}`),
      }));
    });
  }
  return dedupeClaims(claims.filter(hasPricingValue)).slice(0, 30);
}

export function extractManifestPricingClaims(input, sourceUrl) {
  let document = input;
  if (typeof input === "string") {
    try { document = JSON.parse(input); } catch { return []; }
  }
  if (!document || typeof document !== "object") return [];
  const capabilities = Array.isArray(document.capabilities)
    ? document.capabilities
    : Object.entries(object(document.tiers) ?? {}).map(([id, value]) => ({ id, ...object(value) }));
  const claims = [];

  for (const capability of capabilities) {
    if (!capability || typeof capability !== "object") continue;
    const rawPrice = capability.price ?? capability.cost ?? capability.pricing;
    if (typeof rawPrice === "string") {
      for (const claim of extractTextPricingClaims(rawPrice, "capability_manifest", sourceUrl)) {
        claims.push(compactClaim({
          ...claim,
          capability_id: capability.id ?? capability.capability_id ?? capability.name,
          billing_unit: normalizeBillingUnit(capability.billing_unit) ?? claim.billing_unit,
          resource_url: absoluteUrl(capability.endpoint ?? capability.url, sourceUrl) ?? claim.resource_url,
          method: normalizeMethod(capability.method),
        }));
      }
      continue;
    }
    if (!rawPrice || typeof rawPrice !== "object") continue;
    claims.push(compactClaim({
      source: "capability_manifest",
      source_url: sourceUrl,
      capability_id: capability.id ?? capability.capability_id ?? capability.name,
      amount: normalizeDecimal(rawPrice.amount ?? rawPrice.value ?? rawPrice.price),
      currency: normalizeCurrency(rawPrice.currency ?? rawPrice.asset_symbol ?? rawPrice.symbol),
      asset: normalizeAsset(rawPrice.asset ?? rawPrice.asset_address),
      network: normalizeNetwork(rawPrice.network ?? capability.network),
      protocol: normalizeProtocol(rawPrice.protocol ?? capability.payment_protocol ?? capability.access),
      billing_unit: normalizeBillingUnit(capability.billing_unit ?? rawPrice.billing_unit ?? rawPrice.unit),
      resource_url: absoluteUrl(capability.endpoint ?? capability.url, sourceUrl),
      method: normalizeMethod(capability.method),
    }));
  }
  return dedupeClaims(claims.filter(hasPricingValue)).slice(0, 50);
}

export function pricingClaimFromChallenge(terms, fallbackUrl, contextClaims = []) {
  const offer = terms?.accepts?.[0];
  if (!offer || typeof offer !== "object") return null;
  const resourceUrl = absoluteUrl(terms?.resource?.url, fallbackUrl) ?? fallbackUrl;
  const asset = normalizeAsset(typeof offer.asset === "object" ? offer.asset.address ?? offer.asset.id : offer.asset);
  const scope = resourceScope(resourceUrl);
  const related = contextClaims.filter((claim) => resourceScope(claim.resource_url) === scope);
  const currencies = new Set((related.length ? related : contextClaims).map((claim) => claim.currency).filter(Boolean));
  const extra = object(offer.extra) ?? {};
  const currency = normalizeCurrency(extra.symbol ?? extra.name)
    ?? currencyForAsset(asset)
    ?? (currencies.size === 1 ? [...currencies][0] : null);
  const decimals = normalizeDecimals(offer.decimals ?? extra.decimals ?? (currency === "USDC" ? 6 : null));
  const atomicAmount = normalizeInteger(offer.amount);
  const amount = atomicAmount && decimals != null ? decimalFromAtomic(atomicAmount, decimals) : null;
  const description = `${terms?.resource?.description ?? ""} ${terms?.resource?.mimeType ?? ""}`;

  return compactClaim({
    source: "x402_challenge",
    source_url: fallbackUrl,
    amount,
    atomic_amount: atomicAmount,
    decimals,
    currency,
    asset,
    network: normalizeNetwork(offer.network),
    protocol: terms?.x402Version ? `x402-v${terms.x402Version}` : "x402",
    billing_unit: inferBillingUnit(description),
    resource_url: resourceUrl,
    scheme: stringValue(offer.scheme),
  });
}

export function assessPricing({ claims = [], paidResource = null, challengeClaim = null } = {}) {
  const allClaims = dedupeClaims([...claims, ...(challengeClaim ? [challengeClaim] : [])].filter(hasPricingValue));
  const contradictions = findContradictions(allClaims, challengeClaim);
  const complete = {
    canonical_resource: Boolean(paidResource?.url ?? allClaims.find((claim) => claim.resource_url)?.resource_url),
    amount: allClaims.some((claim) => claim.amount != null || claim.atomic_amount != null),
    currency_or_asset: allClaims.some((claim) => claim.currency || claim.asset),
    network: allClaims.some((claim) => claim.network),
    billing_unit: allClaims.some((claim) => claim.billing_unit),
  };
  const missing = Object.entries(complete).filter(([, present]) => !present).map(([field]) => field);
  const status = contradictions.length ? "contradictory" : missing.length ? "incomplete" : "consistent";
  return {
    status,
    enforced: challengeClaim ?? null,
    claims: allClaims,
    contradictions,
    missing_fields: missing,
    canonical_resource_url: paidResource?.url ?? challengeClaim?.resource_url ?? allClaims.find((claim) => claim.resource_url)?.resource_url ?? null,
  };
}

export function publicPricingAssessment(assessment, redactUrl) {
  const publicClaim = (claim) => compactClaim({
    ...claim,
    source_url: claim.source_url ? redactUrl(claim.source_url) : null,
    resource_url: claim.resource_url ? redactUrl(claim.resource_url) : null,
  });
  return {
    status: assessment.status,
    canonical_resource_url: assessment.canonical_resource_url ? redactUrl(assessment.canonical_resource_url) : null,
    enforced: assessment.enforced ? publicClaim(assessment.enforced) : null,
    claims: assessment.claims.map(publicClaim),
    contradictions: assessment.contradictions.map((item) => ({
      scope: item.scope,
      field: item.field,
      documented: publicClaim(item.documented),
      enforced: publicClaim(item.enforced),
    })),
    missing_fields: assessment.missing_fields,
  };
}

export function normalizeDecimal(value) {
  if (value == null) return null;
  const raw = String(value).trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

function findContradictions(claims, challengeClaim) {
  const contradictions = [];
  const groups = new Map();
  for (const claim of claims) {
    const scope = resourceScope(claim.resource_url) ?? (claim.capability_id ? `capability:${claim.capability_id}` : null);
    if (!scope) continue;
    if (!groups.has(scope)) groups.set(scope, []);
    groups.get(scope).push(claim);
  }

  for (const [scope, scopedClaims] of groups) {
    const enforced = scopedClaims.find((claim) => claim.source === "x402_challenge") ?? scopedClaims[0];
    for (const documented of scopedClaims) {
      if (documented === enforced || documented.source === "x402_challenge") continue;
      compareClaimField(contradictions, scope, "amount", documented, enforced);
      compareClaimField(contradictions, scope, "currency", documented, enforced);
      compareClaimField(contradictions, scope, "network", documented, enforced);
    }
  }

  if (challengeClaim) {
    const challengeScope = resourceScope(challengeClaim.resource_url);
    const scopedDocuments = claims.filter((claim) => claim.source !== "x402_challenge" && resourceScope(claim.resource_url) === challengeScope);
    const comparable = scopedDocuments.length ? scopedDocuments : uniqueUnscopedPrice(claims);
    for (const documented of comparable) {
      compareClaimField(contradictions, challengeScope ?? "advertised-resource", "amount", documented, challengeClaim);
      compareClaimField(contradictions, challengeScope ?? "advertised-resource", "currency", documented, challengeClaim);
      compareClaimField(contradictions, challengeScope ?? "advertised-resource", "network", documented, challengeClaim);
    }
  }
  return dedupeContradictions(contradictions).slice(0, 20);
}

function compareClaimField(output, scope, field, documented, enforced) {
  const left = documented[field];
  const right = enforced[field];
  if (left == null || right == null || left === right) return;
  output.push({ scope, field, documented, enforced });
}

function uniqueUnscopedPrice(claims) {
  const candidates = claims.filter((claim) => claim.source !== "x402_challenge" && !resourceScope(claim.resource_url) && claim.amount && claim.currency);
  const values = new Set(candidates.map((claim) => `${claim.amount}|${claim.currency}|${claim.network ?? ""}`));
  return values.size === 1 ? candidates : [];
}

function inferBillingUnit(text) {
  if (!text) return null;
  const slash = String(text).match(/\/\s*(call|request|audit|job|token|month|seat|user|transaction)\b/i);
  if (slash) return normalizeBillingUnit(slash[1]);
  const per = String(text).match(/\bper\s+(?:successful\s+)?(call|request|audit|job|token|month|seat|user|transaction)\b/i);
  if (per) return normalizeBillingUnit(per[1]);
  const explicit = String(text).match(/\bbilling\s+unit\s*[:=-]\s*([a-z][a-z -]{1,40})/i);
  if (explicit) return normalizeBillingUnit(explicit[1]);
  if (/bounded compute reservation/i.test(text)) return "bounded compute reservation";
  return null;
}

function normalizeBillingUnit(value) {
  if (value == null) return null;
  let unit = String(value).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  unit = unit.replace(/^(?:per|each)\s+/, "");
  if (!unit || unit.length > 80) return null;
  const singular = { calls: "call", requests: "request", audits: "audit", jobs: "job", tokens: "token", months: "month", seats: "seat", users: "user", transactions: "transaction" };
  return singular[unit] ?? unit;
}

function inferNetwork(text) {
  if (!text) return null;
  const caip = String(text).match(/\beip155:\d+\b/i);
  if (caip) return caip[0].toLowerCase();
  if (/\bbase\s+sepolia\b/i.test(text)) return "eip155:84532";
  if (/\bbase\s+mainnet\b/i.test(text)) return "eip155:8453";
  return null;
}

function normalizeNetwork(value) {
  if (value == null) return null;
  return inferNetwork(String(value)) ?? (String(value).trim().toLowerCase().slice(0, 120) || null);
}

function inferProtocol(text) {
  if (!text) return null;
  return /x402\s+v?2|x402[- ]v?2/i.test(text) ? "x402-v2" : /x402/i.test(text) ? "x402" : null;
}

function normalizeProtocol(value) {
  if (value == null) return null;
  return inferProtocol(String(value)) ?? (String(value).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80) || null);
}

function inferResourceUrl(context, baseUrl) {
  const absolute = String(context).match(/https?:\/\/[^\s<>"')]+/i)?.[0];
  if (absolute) return absoluteUrl(cleanEndpoint(absolute), baseUrl);
  const methodPath = String(context).match(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD)\s+(\/[^\s,;<>"']+)/i)?.[1];
  return methodPath ? absoluteUrl(cleanEndpoint(methodPath), baseUrl) : null;
}

function cleanEndpoint(value) {
  return String(value).replace(/[.]+$/, "").replace(/[)\]}]+$/, "");
}

function absoluteUrl(value, baseUrl) {
  if (value == null || value === "") return null;
  try { return new URL(String(value), baseUrl).href; } catch { return null; }
}

function resourceScope(value) {
  if (!value) return null;
  try {
    const parsed = new URL(String(value).replace(/\{[^}]+\}/g, "value"));
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "") || "/"}`.toLowerCase();
  } catch { return null; }
}

function decimalFromAtomic(value, decimals) {
  try {
    const atomic = BigInt(value);
    const padded = atomic.toString().padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals) || "0";
    const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, "") : "";
    return normalizeDecimal(fraction ? `${whole}.${fraction}` : whole);
  } catch { return null; }
}

function normalizeInteger(value) {
  const raw = String(value ?? "").trim();
  return /^\d{1,78}$/.test(raw) ? raw.replace(/^0+(?=\d)/, "") : null;
}

function normalizeDecimals(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 30 ? number : null;
}

function currencyForAsset(asset) {
  if (!asset) return null;
  const lower = asset.toLowerCase();
  if (USDC_ASSETS.has(lower) || /(?:^|[^a-z])usdc(?:$|[^a-z])/i.test(asset)) return "USDC";
  return null;
}

function normalizeCurrency(value) {
  if (value == null) return null;
  const upper = String(value).trim().toUpperCase();
  return new RegExp(`^(?:${CURRENCIES})$`).test(upper) ? upper : null;
}

function normalizeAsset(value) {
  if (value == null) return null;
  const asset = String(value).trim();
  return asset && asset.length <= 160 ? asset : null;
}

function normalizeMethod(value) {
  if (value == null) return null;
  const method = String(value).trim().toUpperCase();
  return ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method) ? method : null;
}

function compactClaim(claim) {
  return Object.fromEntries(Object.entries(claim).filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

function hasPricingValue(claim) {
  return Boolean(claim && (claim.amount != null || claim.atomic_amount != null || claim.currency || claim.asset || claim.billing_unit || claim.network));
}

function dedupeClaims(claims) {
  const seen = new Set();
  return claims.filter((claim) => {
    const key = [claim.source, claim.source_url, claim.capability_id, claim.resource_url, claim.amount, claim.atomic_amount, claim.currency, claim.asset, claim.network, claim.billing_unit].join("|");
    return !seen.has(key) && seen.add(key);
  });
}

function dedupeContradictions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.scope}|${item.field}|${item.documented.source}|${item.documented[item.field]}|${item.enforced[item.field]}`;
    return !seen.has(key) && seen.add(key);
  });
}

function array(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : null; }
function stringValue(value) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null; }
function walk(value, visit) { if (!value || typeof value !== "object") return; visit(value); for (const child of Object.values(value)) Array.isArray(child) ? child.forEach((item) => walk(item, visit)) : walk(child, visit); }
