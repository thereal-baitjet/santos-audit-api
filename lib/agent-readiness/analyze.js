import * as cheerio from "cheerio";
import { parseDocument } from "yaml";
import { safeFetch, validateTarget, AuditError } from "../safe-fetch.js";
import {
  AGENT_READINESS_SCHEMA_VERSION,
  CHECK_REGISTRY,
} from "./contract.js";
import { computeScore, prioritizedActions, readinessLevel } from "./scoring.js";
import { assertAgentReadinessResult } from "./validation.js";
import {
  assessPricing,
  extractJsonLdPricingClaims,
  extractManifestPricingClaims,
  extractTextPricingClaims,
  pricingClaimFromChallenge,
  publicPricingAssessment,
} from "./pricing.js";

const JSON_TYPES = /^(application\/(json|problem\+json|.*\+json)|text\/(plain|yaml)|application\/(yaml|x-yaml))\b/i;
const TEXT_TYPES = /^(text\/(html|plain|markdown|yaml)|application\/(json|ld\+json|problem\+json|.*\+json|yaml|x-yaml)|application\/xhtml\+xml)\b/i;
const MCP_TYPES = /^(application\/json|text\/event-stream)\b/i;
const DEFAULT_UA = "SantosAgentReadinessBot/1.0 (+https://api.santosautomation.com/llms.txt; support: baitjet@gmail.com)";
const registryCache = new Map();

export function getAgentReadinessConfig(overrides = {}) {
  return {
    enabled: process.env.AGENT_READINESS_ENABLED !== "false",
    maxFetches: bounded(overrides.maxFetches ?? process.env.AGENT_READINESS_MAX_FETCHES, 0, 20, 8),
    maxBytes: bounded(overrides.maxBytes ?? process.env.AGENT_READINESS_MAX_BYTES, 16_384, 10_000_000, 1_500_000),
    timeoutMs: bounded(overrides.timeoutMs ?? process.env.AGENT_READINESS_TIMEOUT_MS, 500, 30_000, 8_000),
    maxDocLinks: bounded(overrides.maxDocLinks ?? process.env.AGENT_READINESS_MAX_DOC_LINKS, 0, 10, 2),
    maxSitemapUrls: bounded(overrides.maxSitemapUrls ?? process.env.AGENT_READINESS_MAX_SITEMAP_URLS, 0, 500, 25),
    deepMaxPages: bounded(overrides.deepMaxPages ?? process.env.AGENT_READINESS_DEEP_MAX_PAGES, 0, 10, 3),
    cacheTtlSeconds: bounded(overrides.cacheTtlSeconds ?? process.env.AGENT_READINESS_CACHE_TTL_SECONDS, 0, 86_400, 3_600),
    registryLookup: overrides.registryLookup ?? process.env.AGENT_READINESS_REGISTRY_LOOKUP_ENABLED === "true",
    mcpProbe: overrides.mcpProbe ?? process.env.AGENT_READINESS_MCP_PROBE_ENABLED === "true",
    registryBaseUrl: overrides.registryBaseUrl?.trim() || process.env.MCP_REGISTRY_BASE_URL?.trim() || "https://registry.modelcontextprotocol.io",
    userAgent: process.env.AGENT_READINESS_USER_AGENT?.trim() || DEFAULT_UA,
  };
}

export async function auditAgentReadiness(rawUrl, options = {}) {
  const requested = validateTarget(rawUrl).href;
  const config = getAgentReadinessConfig(options);
  if (!config.enabled) throw new AuditError("SERVICE_UNAVAILABLE", "Agent Readiness is disabled");

  const initialOrigin = new URL(requested).origin;
  const budget = createBudget(config, initialOrigin, options.fetcher ?? safeFetch);
  const findings = [];
  const interfaces = {
    llms_txt: { status: "not_found", url: new URL("/llms.txt", initialOrigin).href, valid_format: false },
    openapi: [],
    mcp: [],
    capability_manifests: [],
    pricing: { status: "not_applicable", canonical_resource_url: null, enforced: null, claims: [], contradictions: [], missing_fields: [] },
    structured_data_types: [],
    documentation: [],
    sitemap: { status: "not_checked", sampled_urls: 0 },
  };

  let page;
  if (options.existingPage) {
    page = normalizeExistingPage(options.existingPage, requested);
  } else {
    page = await budget.fetch(requested, { purpose: "root-page", allowedContentTypes: TEXT_TYPES });
  }
  const finalUrl = page.finalUrl ?? requested;
  const canonicalOrigin = new URL(finalUrl).origin;
  budget.setCanonicalOrigin(canonicalOrigin);
  const html = page.body ?? "";
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ").trim();
  const advertised = collectAdvertisedUrls($, page.response?.headers, finalUrl);
  const jsonLd = parseJsonLd($);
  const pricingClaims = [
    ...extractTextPricingClaims(text, "html", finalUrl),
    ...extractJsonLdPricingClaims(jsonLd.documents, finalUrl),
  ];
  interfaces.structured_data_types = [...new Set(jsonLd.types)].sort();

  let signals = classifySignals({ $, text, advertised, jsonLd });
  let profile = selectProfile(signals);
  const applicability = {
    discovery_and_documentation: "tested",
    structured_identity_and_context: "tested",
    api_readiness: signals.api ? "tested" : "not_applicable",
    mcp_readiness: signals.mcp ? "tested" : "not_applicable",
    operational_trust: "tested",
    agent_commerce: signals.commerce ? "tested" : "not_applicable",
  };

  const add = findingWriter(findings);
  assessRoot({ $, text, finalUrl, advertised, jsonLd, jsonLdPricing: pricingClaims.filter((claim) => claim.source === "json_ld"), signals, add });

  const llmsUrl = sameOriginUrl(new URL("/llms.txt", canonicalOrigin).href, canonicalOrigin);
  let llmsText = "";
  if (budget.remaining > 0 && options.mode !== "embedded") {
    const llms = await budget.tryFetch(llmsUrl, { purpose: "llms.txt", allowedContentTypes: TEXT_TYPES, maxResponseBytes: 256_000 });
    if (llms.ok && llms.response.status === 200) {
      llmsText = llms.body;
      const parsed = assessLlmsTxt(llmsText, llms.finalUrl, canonicalOrigin);
      interfaces.llms_txt = { status: "found", url: redactUrl(llms.finalUrl), valid_format: parsed.valid };
      add("agent.llms_txt.present", "pass", "llms.txt is publicly reachable", { source_url: redactUrl(llms.finalUrl), bytes: Buffer.byteLength(llmsText) });
      add("agent.llms_txt.format", parsed.valid ? "pass" : "fail", parsed.valid ? "llms.txt follows the proposed structure" : "llms.txt is incomplete or malformed", parsed.evidence, parsed.valid ? "info" : "moderate");
      add("agent.llms_txt.quality", parsed.quality ? "pass" : "fail", parsed.quality ? "llms.txt explains how agents should use the service" : "llms.txt lacks important selection or interface guidance", parsed.qualityEvidence, parsed.quality ? "info" : "moderate");
      advertised.push(...parsed.urls.map((url) => ({ url, source: "llms.txt", rel: "document" })));
      const lower = llmsText.toLowerCase();
      const llmsPricing = extractTextPricingClaims(llmsText, "llms_txt", llms.finalUrl);
      pricingClaims.push(...llmsPricing);
      const llmsCommerceEvidence = [...lower.matchAll(/\b(x402|usdc|pay per (?:call|request)|machine[- ]payable|micropayment)\b/g)].map((match) => match[1]).slice(0, 8);
      signals = {
        ...signals,
        api: signals.api || /\b(api|openapi|swagger|endpoint)\b/.test(lower),
        mcp: signals.mcp || /\b(model context protocol|mcp)\b/.test(lower),
        commerce: signals.commerce || llmsCommerceEvidence.length > 0,
        commerceEvidence: [...new Set([...signals.commerceEvidence, ...llmsCommerceEvidence])].slice(0, 8),
      };
      applicability.api_readiness = signals.api ? "tested" : "not_applicable";
      applicability.mcp_readiness = signals.mcp ? "tested" : "not_applicable";
      applicability.agent_commerce = signals.commerce ? "tested" : "not_applicable";
      profile = selectProfile(signals);
    } else {
      const status = llms.response?.status;
      add("agent.llms_txt.present", "fail", "No usable llms.txt was found", { source_url: redactUrl(llmsUrl), http_status: status ?? null, error: llms.error?.code }, "low");
    }
  } else if (options.mode === "embedded") {
    add("agent.llms_txt.present", "unknown", "llms.txt was not fetched in the embedded Quick Audit", { reason: "zero-additional-request compatibility mode" }, "info");
  }

  const robotsUrl = new URL("/robots.txt", canonicalOrigin).href;
  if (budget.remaining > 0 && options.mode !== "embedded") {
    const robots = await budget.tryFetch(robotsUrl, { purpose: "robots.txt", allowedContentTypes: TEXT_TYPES, maxResponseBytes: 128_000 });
    if (robots.ok && robots.response.status === 200) {
      const blocked = machinePathsBlocked(robots.body);
      add("agent.crawlability", blocked.length ? "fail" : "pass", blocked.length ? "robots.txt blocks public machine interfaces" : "robots.txt does not block known machine interfaces", { source_url: redactUrl(robots.finalUrl), blocked_paths: blocked }, blocked.length ? "moderate" : "info");
    } else {
      add("agent.crawlability", "pass", "No restrictive robots.txt policy was observed", { source_url: redactUrl(robotsUrl), http_status: robots.response?.status ?? null }, "info", "No action required; publish robots.txt only when crawler policy needs to be explicit.");
    }
  }

  const openApiCandidate = findOpenApiCandidate(advertised, canonicalOrigin, signals.api);
  if (openApiCandidate?.source === "conventional-path") budget.conventionalDiscoveries++;
  if (applicability.api_readiness === "tested") {
    if (openApiCandidate) {
      add("agent.openapi.discovery", openApiCandidate.confidence === "high" ? "pass" : "unknown", openApiCandidate.confidence === "high" ? "OpenAPI is explicitly advertised" : "OpenAPI was found through a conventional candidate path", { source_url: redactUrl(openApiCandidate.url), discovery: openApiCandidate.source }, "info", "Advertise the canonical OpenAPI URL from HTML, llms.txt, or HTTP Link metadata.");
      if (budget.remaining > 0 && options.mode !== "embedded") {
        const fetched = await budget.tryFetch(openApiCandidate.url, { purpose: "openapi", allowedContentTypes: TEXT_TYPES, maxResponseBytes: 750_000 });
        if (fetched.ok && fetched.response.status === 200) {
          const assessment = assessOpenApi(fetched.body);
          interfaces.openapi.push({ url: redactUrl(fetched.finalUrl), version: assessment.version, valid: assessment.valid, validation: assessment.validation });
          add("agent.openapi.valid", assessment.valid ? "pass" : "fail", assessment.valid ? `OpenAPI ${assessment.version} is parseable` : "The advertised API description is invalid", { source_url: redactUrl(fetched.finalUrl), errors: assessment.errors }, assessment.valid ? "info" : "high");
          add("agent.openapi.operations", assessment.operationsStrong ? "pass" : "fail", assessment.operationsStrong ? "Operations have stable selection metadata" : "Operations lack stable IDs or useful descriptions", assessment.operationEvidence, assessment.operationsStrong ? "info" : "moderate");
          add("agent.openapi.schemas", assessment.schemasStrong ? "pass" : "fail", assessment.schemasStrong ? "Requests and responses are machine-described" : "Request, response, or error schemas are incomplete", assessment.schemaEvidence, assessment.schemasStrong ? "info" : "moderate");
          add("agent.openapi.auth_payment", assessment.accessDocumented ? "pass" : "unknown", assessment.accessDocumented ? "Access requirements are documented" : "Authentication or payment semantics were not clearly identified", assessment.accessEvidence, "info");
        } else {
          add("agent.openapi.valid", "fail", "The advertised OpenAPI document was not retrievable", { source_url: redactUrl(openApiCandidate.url), http_status: fetched.response?.status ?? null, error: fetched.error?.code }, "high");
        }
      }
    } else {
      add("agent.openapi.discovery", "fail", "The site appears to provide an API but does not advertise OpenAPI", {}, "high");
    }
  }

  const manifestCandidates = findManifestCandidates(advertised, canonicalOrigin).slice(0, 1);
  if (applicability.api_readiness === "tested" && manifestCandidates.length && budget.remaining > 0 && options.mode !== "embedded") {
    const candidate = manifestCandidates[0];
    const fetched = await budget.tryFetch(candidate.url, { purpose: "capability-manifest", allowedContentTypes: JSON_TYPES, maxResponseBytes: 256_000 });
    const assessment = fetched.ok && fetched.response.status === 200 ? assessCapabilityManifest(fetched.body) : { valid: false, format: null, capabilities: [] };
    const manifestPricing = fetched.ok && fetched.response.status === 200 ? extractManifestPricingClaims(fetched.body, fetched.finalUrl) : [];
    pricingClaims.push(...manifestPricing);
    if (manifestPricing.length) {
      signals = {
        ...signals,
        commerce: true,
        commerceEvidence: [...new Set([...signals.commerceEvidence, ...manifestPricing.map((claim) => claim.protocol ?? claim.currency ?? "machine pricing")])].slice(0, 8),
      };
      applicability.agent_commerce = "tested";
      profile = selectProfile(signals);
    }
    if (assessment.valid) interfaces.capability_manifests.push({ url: redactUrl(fetched.finalUrl), format: assessment.format, standard: false, capabilities: assessment.capabilities });
    add("agent.capabilities.manifest", assessment.valid ? "pass" : "fail", assessment.valid ? "A vendor-specific capability manifest is machine-usable" : "The advertised capability manifest is incomplete", { source_url: redactUrl(candidate.url), format: assessment.format, standard: false }, assessment.valid ? "info" : "moderate");
  }

  const mcpCandidate = findMcpCandidate(advertised, canonicalOrigin);
  if (applicability.mcp_readiness === "tested") {
    if (mcpCandidate) {
      add("agent.mcp.advertised", mcpCandidate.confidence === "high" ? "pass" : "unknown", mcpCandidate.confidence === "high" ? "MCP is explicitly advertised" : "MCP is only weakly inferred", { source_url: redactUrl(mcpCandidate.url), discovery: mcpCandidate.source }, "info");
      interfaces.mcp.push({ url: redactUrl(mcpCandidate.url), advertised: mcpCandidate.confidence === "high", probed: false });
      if (config.mcpProbe && budget.remaining >= 2 && options.mode !== "embedded") {
        const probe = await probeMcp(mcpCandidate.url, budget, config);
        interfaces.mcp[0] = { ...interfaces.mcp[0], ...probe.interface };
        add("agent.mcp.transport", probe.transportStatus, probe.transportTitle, probe.transportEvidence, probe.transportStatus === "fail" ? "high" : "info");
        add("agent.mcp.tools", probe.toolsStatus, probe.toolsTitle, probe.toolsEvidence, probe.toolsStatus === "fail" ? "moderate" : "info");
        add("agent.mcp.structured_output", probe.structuredStatus, probe.structuredTitle, probe.structuredEvidence, probe.structuredStatus === "fail" ? "moderate" : "info");
        add("agent.mcp.safety", probe.safetyStatus, probe.safetyTitle, probe.safetyEvidence, "info");
      } else {
        add("agent.mcp.transport", "unknown", "MCP transport was not probed", { reason: config.mcpProbe ? "fetch budget" : "AGENT_READINESS_MCP_PROBE_ENABLED is false" }, "info");
      }
      if (config.registryLookup && budget.remaining > 0 && options.mode !== "embedded") {
        const registry = await lookupMcpRegistry(new URL(finalUrl).hostname, budget, config);
        add("agent.mcp.registry", registry.matched ? "pass" : "unknown", registry.matched ? "A matching official MCP Registry entry was found" : "No domain-matched entry was found in the bounded registry page", registry.evidence, "info");
      } else {
        add("agent.mcp.registry", "unknown", "Official MCP Registry lookup was not enabled", { registry_status: "preview", feature_flag: "AGENT_READINESS_REGISTRY_LOOKUP_ENABLED" }, "info");
      }
    } else {
      add("agent.mcp.advertised", "fail", "The site claims MCP support but no endpoint or registry-backed interface was advertised", {}, "moderate");
    }
  }

  if (applicability.agent_commerce === "tested") {
    add("agent.commerce.applicable", "pass", "The service explicitly advertises machine commerce", { signals: signals.commerceEvidence }, "info");
    const paidCandidate = findPaidCandidate(advertised, canonicalOrigin, pricingClaims);
    let challenge = null;
    if (paidCandidate && budget.remaining > 0 && options.mode !== "embedded") {
      challenge = await inspectPaymentChallenge(paidCandidate.url, budget, pricingClaims);
      add("agent.commerce.challenge", challenge.valid ? "pass" : "fail", challenge.valid ? "The unpaid x402 challenge is machine-readable" : "The paid resource did not return a valid passive challenge", challenge.evidence, challenge.valid ? "info" : "high");
    }
    const pricing = assessPricing({ claims: pricingClaims, paidResource: paidCandidate, challengeClaim: challenge?.claim });
    interfaces.pricing = publicPricingAssessment(pricing, redactUrl);
    const pricingPass = pricing.status === "consistent";
    const pricingTitle = pricing.status === "contradictory"
      ? "The enforced price contradicts public pricing metadata"
      : pricing.status === "incomplete"
        ? "Machine-payment pricing metadata is incomplete"
        : "Price, billing unit, network, asset, and paid resource are consistent";
    add("agent.commerce.discovery", pricingPass ? "pass" : "fail", pricingTitle, {
      status: pricing.status,
      canonical_resource_url: pricing.canonical_resource_url ? redactUrl(pricing.canonical_resource_url) : null,
      missing_fields: pricing.missing_fields,
      contradictions: interfaces.pricing.contradictions,
      claim_sources: [...new Set(pricing.claims.map((claim) => claim.source))],
    }, pricing.status === "contradictory" ? "high" : pricingPass ? "info" : "moderate");
    updatePricingConsistencyFinding(findings, interfaces.pricing);
    const commerceText = `${text} ${llmsText}`.toLowerCase();
    add("agent.commerce.idempotency", /idempotenc|duplicate|retry/.test(commerceText) ? "pass" : "fail", /idempotenc|duplicate|retry/.test(commerceText) ? "Retry or idempotency behavior is documented" : "Duplicate-payment and retry behavior is not documented", {}, "moderate");
    add("agent.commerce.errors", /settle|receipt|refund|failure|not charged/.test(commerceText) ? "pass" : "fail", /settle|receipt|refund|failure|not charged/.test(commerceText) ? "Settlement and failure behavior is documented" : "Settlement, receipt, and failure behavior is incomplete", {}, "moderate");
  }

  // Low-priority discovery runs only after the interface-specific probes so it
  // cannot crowd OpenAPI/MCP/commerce evidence out of the shared request budget.
  if (budget.remaining > 0 && options.mode !== "embedded") {
    const sitemapUrl = new URL("/sitemap.xml", canonicalOrigin).href;
    const sitemap = await budget.tryFetch(sitemapUrl, { purpose: "sitemap-sample", allowedContentTypes: /^(application|text)\/(xml|xhtml\+xml)\b/i, maxResponseBytes: 256_000 });
    if (sitemap.ok && sitemap.response.status === 200) {
      const urls = [...sitemap.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
        .map((match) => match[1].trim())
        .filter((url) => { try { return new URL(url).origin === canonicalOrigin; } catch { return false; } })
        .slice(0, config.maxSitemapUrls);
      interfaces.sitemap = { status: "found", url: redactUrl(sitemap.finalUrl), sampled_urls: urls.length };
    } else {
      interfaces.sitemap = { status: "not_found", url: redactUrl(sitemapUrl), sampled_urls: 0 };
    }
  }

  const docLimit = options.mode === "deep" ? config.deepMaxPages : config.maxDocLinks;
  const docCandidates = advertised
    .filter((item) => isRelatedServiceUrl(item.url, canonicalOrigin) && /docs?|developer|reference|\.md(?:$|\?)/i.test(item.url))
    .filter((item) => !interfaces.documentation.some((doc) => doc.url === redactUrl(item.url)))
    .slice(0, docLimit);
  for (const candidate of docCandidates) {
    if (budget.remaining <= 0 || options.mode === "embedded") break;
    const fetched = await budget.tryFetch(candidate.url, { purpose: "advertised-documentation", allowedContentTypes: TEXT_TYPES, maxResponseBytes: 256_000 });
    interfaces.documentation.push({ url: redactUrl(candidate.url), status: fetched.response?.status ?? null, readable: Boolean(fetched.ok && fetched.response.status === 200 && fetched.body.trim().length >= 80) });
  }

  fillMissingFindings(findings, applicability);
  const scored = computeScore(findings, applicability);
  const interfacesForLevel = interfaces;
  const level = readinessLevel(interfacesForLevel, findings);
  const confidence = Math.round(Math.min(0.98, Math.max(0.2, 0.35 + scored.tested_coverage_percent / 160 - (budget.conventionalDiscoveries ? 0.08 : 0))) * 100) / 100;

  return assertAgentReadinessResult({
    schema_version: AGENT_READINESS_SCHEMA_VERSION,
    target: { requested_url: requested, canonical_origin: canonicalOrigin, final_url: finalUrl },
    profile,
    readiness_level: level,
    score: scored.score,
    grade: scored.grade,
    confidence,
    tested_coverage_percent: scored.tested_coverage_percent,
    applicability,
    subscores: scored.subscores,
    interfaces,
    findings,
    recommended_actions: prioritizedActions(findings),
    limitations: [
      "Passive public-surface assessment only; no authentication, payment, account creation, forms, or business tools were invoked.",
      "llms.txt is evaluated as a proposal and is not treated as a mandatory web standard.",
      applicability.mcp_readiness === "not_applicable" ? "MCP was not applicable because no MCP interface was advertised or registry-matched." : null,
      applicability.api_readiness === "not_applicable" ? "API readiness was not applicable because the target did not advertise an API product." : null,
      options.mode === "embedded" ? "Embedded Quick Audit mode uses the already-fetched page and performs no additional discovery requests." : null,
    ].filter(Boolean),
    fetch_budget: budget.summary(),
  });
}

function bounded(value, min, max, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
}

function createBudget(config, initialOrigin, fetcher) {
  let canonicalOrigin = initialOrigin;
  let fetches = 0;
  let bytes = 0;
  const requests = [];
  return {
    conventionalDiscoveries: 0,
    setCanonicalOrigin(origin) { canonicalOrigin = origin; },
    get remaining() { return Math.max(0, config.maxFetches - fetches); },
    async fetch(url, opts = {}) {
      if (fetches >= config.maxFetches) throw new AuditError("FETCH_BUDGET_EXCEEDED", "Agent Readiness request budget exhausted");
      const parsed = validateTarget(url);
      if (!opts.allowCrossOrigin && !isRelatedServiceUrl(parsed.href, canonicalOrigin) && !isRelatedServiceUrl(parsed.href, initialOrigin)) {
        throw new AuditError("CROSS_ORIGIN_BLOCKED", "Cross-origin discovery is not allowed");
      }
      const remainingBytes = config.maxBytes - bytes;
      if (remainingBytes <= 0) throw new AuditError("BYTE_BUDGET_EXCEEDED", "Agent Readiness byte budget exhausted");
      fetches++;
      const result = await fetcher(parsed.href, { "user-agent": config.userAgent, ...(opts.headers ?? {}) }, {
        timeoutMs: config.timeoutMs,
        maxResponseBytes: Math.min(opts.maxResponseBytes ?? remainingBytes, remainingBytes),
        maxRedirects: 3,
        allowedContentTypes: opts.allowedContentTypes ?? TEXT_TYPES,
        method: opts.method,
        body: opts.body,
      });
      const size = Buffer.byteLength(result.body ?? "");
      bytes += size;
      requests.push({ purpose: opts.purpose ?? "discovery", url: redactUrl(result.finalUrl ?? parsed.href), status: result.response?.status ?? null, bytes: size, method: opts.method ?? "GET" });
      return result;
    },
    async tryFetch(url, opts) {
      try { return { ok: true, ...(await this.fetch(url, opts)) }; }
      catch (error) {
        requests.push({ purpose: opts?.purpose ?? "discovery", url: redactUrl(url), error: error.code ?? "FETCH_FAILED", method: opts?.method ?? "GET" });
        return { ok: false, error };
      }
    },
    summary() { return { max_fetches: config.maxFetches, fetches_used: fetches, max_bytes: config.maxBytes, bytes_used: bytes, requests }; },
  };
}

function normalizeExistingPage(page, requested) {
  const finalUrl = page.finalUrl ?? page.url ?? requested;
  const headers = new Headers(page.headers ?? {});
  return { body: page.body ?? page.html ?? "", finalUrl, response: { status: page.status ?? 200, headers } };
}

function collectAdvertisedUrls($, headers, baseUrl) {
  const found = [];
  $("a[href], link[href]").each((_, element) => {
    const href = $(element).attr("href");
    try {
      const url = new URL(href, baseUrl);
      if (["http:", "https:"].includes(url.protocol)) found.push({
        url: url.href,
        source: element.tagName === "link" ? "html-link" : "html-anchor",
        rel: $(element).attr("rel") ?? "",
        label: $(element).text().replace(/\s+/g, " ").trim().slice(0, 160),
      });
    } catch { /* ignore malformed advertised links */ }
  });
  const linkHeader = headers?.get?.("link") ?? "";
  for (const match of linkHeader.matchAll(/<([^>]+)>\s*(?:;\s*rel="?([^";,]+)"?)?/g)) {
    try { found.push({ url: new URL(match[1], baseUrl).href, source: "http-link", rel: match[2] ?? "" }); } catch { /* ignore */ }
  }
  return dedupeUrls(found);
}

function parseJsonLd($) {
  const types = [];
  const errors = [];
  const documents = [];
  $('script[type="application/ld+json"]').each((index, element) => {
    try {
      const value = JSON.parse($(element).text());
      documents.push(value);
      walkJson(value, (node) => {
        const raw = node?.["@type"];
        for (const type of Array.isArray(raw) ? raw : raw ? [raw] : []) types.push(String(type));
      });
    } catch (error) { errors.push({ block: index + 1, error: String(error.message).slice(0, 160) }); }
  });
  return { types, errors, documents };
}

function classifySignals({ $, text, advertised, jsonLd }) {
  const lower = text.toLowerCase();
  const urls = advertised.map((item) => item.url.toLowerCase());
  const api = /\b(api|developer docs|openapi|swagger|endpoint)\b/.test(lower) || urls.some((url) => /openapi|swagger|\/api(?:\/|$)/.test(url)) || jsonLd.types.includes("WebAPI");
  const mcp = /\bmodel context protocol\b|\bmcp (server|tool|endpoint)\b/.test(lower) || urls.some((url) => /\/mcp(?:\/|$|\?)/.test(url));
  const commerceEvidence = [...lower.matchAll(/\b(x402|usdc|pay per (?:call|request)|machine[- ]payable|micropayment)\b/g)].map((m) => m[1]).slice(0, 8);
  const commerce = commerceEvidence.length > 0 || jsonLd.types.includes("Offer");
  const docs = /\b(documentation|developer|api reference|quickstart)\b/.test(lower) || $("article, main pre, main code").length > 0;
  return { api, mcp, commerce, docs, commerceEvidence };
}

function selectProfile(signals) {
  if (signals.commerce) return "agent_commerce_provider";
  if (signals.mcp) return "mcp_provider";
  if (signals.api) return "api_provider";
  if (signals.docs) return "documentation_site";
  return "general_website";
}

function assessRoot({ $, text, finalUrl, advertised, jsonLd, jsonLdPricing, signals, add }) {
  const machineLinks = advertised.filter((item) => /openapi|swagger|llms\.txt|\/mcp(?:\/|$|\?)|capabilit|service-desc/i.test(`${item.url} ${item.rel}`));
  add("agent.discovery.links", machineLinks.length ? "pass" : "fail", machineLinks.length ? "Machine-readable interfaces are advertised" : "No machine-interface discovery links were found", { links: machineLinks.slice(0, 12).map((item) => ({ url: redactUrl(item.url), source: item.source, rel: item.rel })) }, machineLinks.length ? "info" : "low");
  add("agent.docs.machine_readable", text.length >= 80 ? "pass" : "fail", text.length >= 80 ? "Public documentation is readable without interaction" : "The public page exposes little machine-readable documentation", { source_url: redactUrl(finalUrl), text_characters: text.length }, text.length >= 80 ? "info" : "moderate");
  add("agent.jsonld.parseable", jsonLd.errors.length ? "fail" : "pass", jsonLd.errors.length ? "One or more JSON-LD blocks are invalid" : "JSON-LD blocks parse without remote context execution", { blocks: jsonLd.documents.length + jsonLd.errors.length, errors: jsonLd.errors }, jsonLd.errors.length ? "moderate" : "info");
  const identityTypes = jsonLd.types.filter((type) => ["Organization", "Person", "WebSite", "Service", "Product", "SoftwareApplication", "WebAPI", "ProfessionalService"].includes(type));
  add("agent.jsonld.identity", identityTypes.length ? "pass" : "fail", identityTypes.length ? "Structured identity metadata is present" : "No useful structured provider identity was found", { types: identityTypes }, identityTypes.length ? "info" : "low");
  if (signals.api) add("agent.jsonld.webapi", jsonLd.types.includes("WebAPI") ? "pass" : "fail", jsonLd.types.includes("WebAPI") ? "Schema.org WebAPI metadata is present" : "The advertised API lacks WebAPI structured metadata", { types: jsonLd.types }, jsonLd.types.includes("WebAPI") ? "info" : "low");
  if (signals.commerce) {
    const completeOffers = jsonLdPricing.filter((claim) => claim.amount && claim.currency);
    add(
      "agent.jsonld.offer",
      completeOffers.length ? "pass" : "fail",
      completeOffers.length ? "Machine-readable Offer pricing metadata is present" : "Paid access is advertised without a complete Offer price and currency",
      { types: jsonLd.types, offers: completeOffers.map((claim) => ({ amount: claim.amount, currency: claim.currency, billing_unit: claim.billing_unit ?? null, resource_url: claim.resource_url ? redactUrl(claim.resource_url) : null })) },
      completeOffers.length ? "info" : "low",
    );
  }
  add("agent.metadata.consistency", "unknown", "Cross-surface consistency requires discovered interface documents", { root_identity_types: identityTypes }, "info");
  add("agent.trust.https", finalUrl.startsWith("https://") ? "pass" : "fail", finalUrl.startsWith("https://") ? "The canonical interface uses HTTPS" : "The canonical interface is not HTTPS", { source_url: redactUrl(finalUrl) }, finalUrl.startsWith("https://") ? "info" : "high");
  add("agent.trust.contact", /mailto:|support|contact|status|changelog|version/i.test($.html()) ? "pass" : "fail", /mailto:|support|contact|status|changelog|version/i.test($.html()) ? "Provider or support information is published" : "Support, status, or version information is hard to discover", {}, "low");
  add("agent.trust.terms_privacy", /terms|privacy|retention|acceptable use/i.test(text) ? "pass" : "fail", /terms|privacy|retention|acceptable use/i.test(text) ? "Terms, privacy, or retention information is discoverable" : "Terms, privacy, and retention information were not found", {}, "low");
  add("agent.trust.errors_limits", /rate limit|quota|timeout|retry|error|limit/i.test(text) ? "pass" : "unknown", /rate limit|quota|timeout|retry|error|limit/i.test(text) ? "Errors or operational limits are documented" : "Operational limits were not established from the root page", {}, "info");
  add("agent.trust.claim_accuracy", /limitations?|not (?:a |full )|does not|passive|single.page/i.test(text) ? "pass" : "unknown", /limitations?|not (?:a |full )|does not|passive|single.page/i.test(text) ? "The service publishes scope limitations" : "Claim accuracy needs corroboration from interface documents", {}, "info");
}

function assessLlmsTxt(body, sourceUrl, origin) {
  const lines = body.split(/\r?\n/);
  const h1 = lines.find((line) => /^#\s+\S/.test(line));
  const h2 = lines.filter((line) => /^##\s+\S/.test(line));
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)|https?:\/\/[^\s)>]+/g)].map((match) => match[1] ?? match[0].replace(/[.,;]+$/, ""));
  const urls = [];
  for (const link of links) {
    try {
      const url = new URL(link, sourceUrl);
      if (["http:", "https:"].includes(url.protocol) && isRelatedServiceUrl(url.href, origin)) urls.push(url.href);
    } catch { /* invalid link is counted below */ }
  }
  const valid = Boolean(h1 && h2.length && body.length <= 256_000 && links.length > 0);
  const lower = body.toLowerCase();
  const qualityTerms = ["api", "openapi", "mcp", "capabilit", "payment", "price", "support", "limitation", "synchronous", "asynchronous"];
  const present = qualityTerms.filter((term) => lower.includes(term));
  return {
    valid,
    quality: present.length >= 4,
    urls: [...new Set(urls)],
    evidence: { source_url: redactUrl(sourceUrl), has_h1: Boolean(h1), h2_sections: h2.length, links: links.length, bytes: Buffer.byteLength(body) },
    qualityEvidence: { source_url: redactUrl(sourceUrl), selection_topics_found: present },
  };
}

function assessOpenApi(body) {
  let doc;
  const errors = [];
  try {
    const parsed = parseDocument(body, { maxAliasCount: 0, prettyErrors: false });
    if (parsed.errors.length) errors.push(...parsed.errors.slice(0, 5).map((error) => error.message.slice(0, 240)));
    else doc = parsed.toJS({ maxAliasCount: 0 });
  } catch (error) { errors.push(`OpenAPI parser error: ${String(error.message ?? error).slice(0, 240)}`); }
  const version = doc?.openapi ?? doc?.swagger ?? null;
  const paths = doc?.paths && typeof doc.paths === "object" ? doc.paths : {};
  if (!version) errors.push("Missing openapi/swagger version field.");
  if (!doc?.info?.title) errors.push("Missing info.title.");
  if (!Object.keys(paths).length) errors.push("No paths were defined.");
  const operations = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of ["get", "post", "put", "patch", "delete", "options", "head"]) {
      if (item?.[method]) operations.push({ path, method, ...item[method] });
    }
  }
  const ids = operations.filter((operation) => typeof operation.operationId === "string" && operation.operationId.trim()).length;
  const described = operations.filter((operation) => operation.summary || operation.description).length;
  const requestSchemas = operations.filter((operation) => operation.requestBody || operation.parameters?.some((p) => p.schema)).length;
  const responseSchemas = operations.filter((operation) => Object.values(operation.responses ?? {}).some((response) => response?.content && Object.values(response.content).some((media) => media?.schema))).length;
  const errorSchemas = operations.filter((operation) => Object.entries(operation.responses ?? {}).some(([code, response]) => !String(code).startsWith("2") && response?.content)).length;
  const accessDocumented = Boolean(doc?.components?.securitySchemes && Object.keys(doc.components.securitySchemes).length) || /x402|payment|required|authorization/i.test(JSON.stringify(doc).slice(0, 500_000));
  return {
    version,
    valid: errors.length === 0 && /^(3\.[012]\.|2\.0)/.test(String(version)),
    validation: "yaml-parser-plus-bounded-structural",
    errors,
    operationsStrong: operations.length > 0 && ids === operations.length && described >= Math.ceil(operations.length * 0.8),
    schemasStrong: operations.length > 0 && responseSchemas >= Math.ceil(operations.length * 0.7) && (requestSchemas > 0 || operations.every((op) => op.method === "get")) && errorSchemas > 0,
    accessDocumented,
    operationEvidence: { operations: operations.length, with_operation_id: ids, with_summary_or_description: described },
    schemaEvidence: { operations: operations.length, with_request_schema: requestSchemas, with_response_schema: responseSchemas, with_error_schema: errorSchemas },
    accessEvidence: { security_schemes: Object.keys(doc?.components?.securitySchemes ?? {}), payment_language_found: /x402|payment/i.test(JSON.stringify(doc).slice(0, 500_000)) },
  };
}

function assessCapabilityManifest(body) {
  try {
    const doc = JSON.parse(body);
    const capabilities = Array.isArray(doc.capabilities) ? doc.capabilities : Object.entries(doc.tiers ?? {}).map(([id, value]) => ({ id, ...value }));
    const strong = capabilities.filter((item) => item && (item.id || item.capability_id || item.name) && (item.endpoint || item.invocation || item.url) && (item.description || item.mode || item.input_schema)).length;
    return { valid: capabilities.length > 0 && strong === capabilities.length, format: doc.manifest_type ?? doc.manifest_version ? "vendor-specific" : "heuristic", capabilities: capabilities.map((item) => item.id ?? item.capability_id ?? item.name).filter(Boolean) };
  } catch { return { valid: false, format: null, capabilities: [] }; }
}

async function probeMcp(url, budget, config) {
  const initialize = await budget.tryFetch(url, {
    purpose: "mcp-initialize",
    allowedContentTypes: MCP_TYPES,
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "santos-agent-readiness", version: "1.0.0" } } }),
    maxResponseBytes: 256_000,
  });
  if (!initialize.ok || initialize.response.status !== 200) {
    const protectedStatus = [401, 403, 402].includes(initialize.response?.status);
    return {
      interface: { probed: true, status: protectedStatus ? "protected" : "unreachable" },
      transportStatus: protectedStatus ? "unknown" : "fail",
      transportTitle: protectedStatus ? "MCP endpoint requires authorization or payment" : "MCP initialize did not succeed",
      transportEvidence: { http_status: initialize.response?.status ?? null, error: initialize.error?.code },
      toolsStatus: "unknown", toolsTitle: "tools/list was not attempted", toolsEvidence: {},
      structuredStatus: "unknown", structuredTitle: "Structured output could not be assessed", structuredEvidence: {},
      safetyStatus: "unknown", safetyTitle: "Tool safety annotations could not be assessed", safetyEvidence: {},
    };
  }
  const initDoc = parseRpcBody(initialize.body);
  const protocolVersion = initDoc?.result?.protocolVersion;
  const session = initialize.response.headers.get("mcp-session-id");
  const tools = await budget.tryFetch(url, {
    purpose: "mcp-tools-list",
    allowedContentTypes: MCP_TYPES,
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": protocolVersion ?? "2025-11-25", ...(session ? { "mcp-session-id": session } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    maxResponseBytes: 512_000,
  });
  const toolsDoc = tools.ok ? parseRpcBody(tools.body) : null;
  const list = Array.isArray(toolsDoc?.result?.tools) ? toolsDoc.result.tools : [];
  const strict = list.filter((tool) => tool.inputSchema?.type === "object" && tool.inputSchema?.additionalProperties === false).length;
  const structured = list.filter((tool) => tool.outputSchema).length;
  const annotated = list.filter((tool) => tool.annotations && Object.keys(tool.annotations).length).length;
  return {
    interface: { probed: true, status: list.length ? "confirmed" : "transport-only", protocol_version: protocolVersion ?? null, tool_count: list.length },
    transportStatus: protocolVersion ? "pass" : "fail", transportTitle: protocolVersion ? `MCP negotiated ${protocolVersion}` : "MCP initialize response lacked a protocol version", transportEvidence: { protocol_version: protocolVersion ?? null, session_id_issued: Boolean(session) },
    toolsStatus: list.length && strict === list.length ? "pass" : list.length ? "fail" : "unknown", toolsTitle: list.length ? `${list.length} MCP tools listed without invocation` : "tools/list returned no tools", toolsEvidence: { tools: list.map((tool) => tool.name), strict_input_schemas: strict },
    structuredStatus: list.length && structured === list.length ? "pass" : list.length ? "fail" : "unknown", structuredTitle: structured === list.length && list.length ? "All tools define output schemas" : "Some tools lack output schemas", structuredEvidence: { tool_count: list.length, with_output_schema: structured },
    safetyStatus: list.length && annotated === list.length ? "pass" : "unknown", safetyTitle: annotated === list.length && list.length ? "All tools publish safety annotations" : "Safety annotations are incomplete", safetyEvidence: { tool_count: list.length, with_annotations: annotated },
  };
}

async function lookupMcpRegistry(hostname, budget, config) {
  const cacheKey = `${config.registryBaseUrl}|${hostname.toLowerCase()}`;
  const cached = registryCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return { ...cached.value, evidence: { ...cached.value.evidence, cached: true } };
  const url = `${config.registryBaseUrl.replace(/\/$/, "")}/v0.1/servers?limit=100`;
  const fetched = await budget.tryFetch(url, { purpose: "mcp-registry", allowCrossOrigin: true, allowedContentTypes: JSON_TYPES, maxResponseBytes: 750_000 });
  if (!fetched.ok || fetched.response.status !== 200) return { matched: false, evidence: { registry_url: redactUrl(url), http_status: fetched.response?.status ?? null, status: "unavailable" } };
  let doc;
  try { doc = JSON.parse(fetched.body); } catch { return { matched: false, evidence: { registry_url: redactUrl(url), status: "invalid_response" } }; }
  const servers = doc.servers ?? doc.items ?? [];
  const matches = servers.filter((item) => JSON.stringify(item).toLowerCase().includes(hostname.toLowerCase())).slice(0, 5);
  const value = { matched: matches.length > 0, evidence: { registry_url: redactUrl(url), registry_status: "preview", bounded_page_count: servers.length, matches: matches.map((item) => item.name ?? item.server?.name).filter(Boolean), cached: false } };
  if (config.cacheTtlSeconds > 0) registryCache.set(cacheKey, { value, expiresAt: Date.now() + config.cacheTtlSeconds * 1000 });
  return value;
}

async function inspectPaymentChallenge(url, budget, pricingClaims) {
  const fetched = await budget.tryFetch(url, { purpose: "unpaid-payment-challenge", allowedContentTypes: JSON_TYPES, maxResponseBytes: 256_000 });
  const encoded = fetched.response?.headers.get("payment-required");
  let terms;
  try { terms = encoded ? JSON.parse(Buffer.from(encoded, "base64").toString("utf-8")) : null; } catch { terms = null; }
  const offer = terms?.accepts?.[0];
  const valid = Boolean(fetched.response?.status === 402 && terms?.x402Version === 2 && offer?.network && offer?.amount && offer?.asset && offer?.payTo);
  const claim = valid ? pricingClaimFromChallenge(terms, url, pricingClaims) : null;
  return {
    valid,
    claim,
    evidence: {
      http_status: fetched.response?.status ?? null,
      x402_version: terms?.x402Version ?? null,
      scheme: offer?.scheme ?? null,
      network: offer?.network ?? null,
      amount: offer?.amount ?? null,
      normalized_amount: claim?.amount ?? null,
      currency: claim?.currency ?? null,
      asset: typeof offer?.asset === "object" ? offer.asset.address ?? offer.asset.id ?? null : offer?.asset ?? null,
      resource_url: redactUrl(terms?.resource?.url ?? url),
      payment_signature_sent: false,
    },
  };
}

function findOpenApiCandidate(advertised, origin, apiSignal) {
  const explicit = advertised.find((item) => isRelatedServiceUrl(item.url, origin) && (/openapi|swagger/i.test(item.url) || /service-desc/i.test(item.rel)));
  if (explicit) return { ...explicit, confidence: "high" };
  if (apiSignal) return { url: new URL("/openapi.json", origin).href, source: "conventional-path", confidence: "low" };
  return null;
}

function findManifestCandidates(advertised, origin) {
  return advertised.filter((item) => isRelatedServiceUrl(item.url, origin) && /capabilit|service[-_.]?manifest|\/api\/?$/i.test(item.url) && !/manifest\.webmanifest/i.test(item.url));
}

function findMcpCandidate(advertised, origin) {
  const item = advertised.find((candidate) => isRelatedServiceUrl(candidate.url, origin) && /\/mcp(?:\/|$|\?)/i.test(candidate.url));
  // Candidates exist only when the target explicitly links an MCP-shaped URL;
  // the analyzer never guesses /mcp.
  return item ? { ...item, confidence: "high" } : null;
}

function findPaidCandidate(advertised, origin, pricingClaims = []) {
  const explicit = advertised.find((candidate) => isRelatedServiceUrl(candidate.url, origin)
    && (/\/api\/audit\?|\/v1\/audits(?:\?|$)/i.test(candidate.url) || /\b(x402|paid|pay|purchase|buy)\b/i.test(`${candidate.rel ?? ""} ${candidate.label ?? ""}`)));
  if (explicit) return { ...explicit, method: "GET" };
  const machinePricedGet = pricingClaims.find((claim) => claim.resource_url
    && isRelatedServiceUrl(claim.resource_url, origin)
    && (!claim.method || claim.method === "GET")
    && /^x402(?:-|$)/i.test(claim.protocol ?? ""));
  return machinePricedGet ? { url: machinePricedGet.resource_url, source: machinePricedGet.source, method: machinePricedGet.method ?? "GET" } : null;
}

function updatePricingConsistencyFinding(findings, pricing) {
  const finding = findings.find((item) => item.id === "agent.metadata.consistency");
  if (!finding) return;
  const sources = [...new Set(pricing.claims.map((claim) => claim.source))];
  if (pricing.status === "contradictory") {
    Object.assign(finding, {
      status: "fail",
      severity: "high",
      confidence: pricing.enforced ? "high" : "medium",
      title: "Pricing claims contradict the enforced paid-resource terms",
      evidence: { pricing_status: pricing.status, sources, contradictions: pricing.contradictions },
    });
  } else if (pricing.status === "consistent" && sources.length >= 2) {
    Object.assign(finding, {
      status: "pass",
      severity: "info",
      confidence: pricing.enforced ? "high" : "medium",
      title: "Pricing is consistent across the discovered public surfaces",
      evidence: { pricing_status: pricing.status, sources, contradictions: [] },
    });
  } else {
    Object.assign(finding, {
      status: "unknown",
      severity: "info",
      confidence: "medium",
      title: "Cross-surface pricing consistency could not be fully established",
      evidence: { pricing_status: pricing.status, sources, missing_fields: pricing.missing_fields },
    });
  }
}

function findCheck(id) { return CHECK_REGISTRY.find((check) => check.id === id); }

function findingWriter(findings) {
  return (id, status, title, evidence = {}, severity = "moderate", confidence = "high", recommendation) => {
    if (findings.some((finding) => finding.id === id)) return;
    if (!['low', 'medium', 'high'].includes(confidence)) {
      recommendation = confidence;
      confidence = "high";
    }
    const def = findCheck(id);
    findings.push({ id, category: def?.category ?? "meta", severity, confidence, status, title, evidence, recommendation: recommendation ?? def?.remediation ?? "Review this interface." });
  };
}

function fillMissingFindings(findings, applicability) {
  const add = findingWriter(findings);
  for (const check of CHECK_REGISTRY) {
    if (findings.some((finding) => finding.id === check.id)) continue;
    if (applicability[check.category] === "not_applicable") add(check.id, "not_applicable", "This check is not applicable to the classified target", {}, "info", "high", "No action required unless this interface becomes applicable.");
    else add(check.id, "unknown", "This check was not established within the bounded assessment", { reason: "not_discovered_or_budget_limited" }, "info", "medium");
  }
  findings.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}

function machinePathsBlocked(body) {
  const blocked = [];
  const lower = body.toLowerCase();
  for (const path of ["/llms.txt", "/openapi.json", "/mcp", "/api"]) {
    if (new RegExp(`disallow:\\s*${path.replace(".", "\\.")}(?:\\s|$)`, "i").test(lower)) blocked.push(path);
  }
  return blocked;
}

function parseRpcBody(body) {
  const data = body.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).find(Boolean) ?? body;
  try { return JSON.parse(data); } catch { return null; }
}

function sameOriginUrl(url, origin) { const parsed = new URL(url); return parsed.origin === origin ? parsed.href : null; }
function isRelatedServiceUrl(raw, origin) {
  try {
    const candidate = new URL(raw);
    const base = new URL(origin);
    const serviceHost = (host) => host.toLowerCase().replace(/^(?:www|api)\./, "");
    return ["http:", "https:"].includes(candidate.protocol) && serviceHost(candidate.hostname) === serviceHost(base.hostname);
  } catch { return false; }
}
function dedupeUrls(items) { const seen = new Set(); return items.filter((item) => !seen.has(item.url) && seen.add(item.url)); }
function walkJson(value, visit) { if (!value || typeof value !== "object") return; visit(value); for (const child of Object.values(value)) Array.isArray(child) ? child.forEach((item) => walkJson(item, visit)) : walkJson(child, visit); }
function redactUrl(raw) { try { const url = new URL(raw); url.username = ""; url.password = ""; url.search = url.search ? "?…" : ""; url.hash = ""; return url.href; } catch { return "(unparseable)"; } }
