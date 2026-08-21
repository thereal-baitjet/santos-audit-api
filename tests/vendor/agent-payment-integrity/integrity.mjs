import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import ipaddr from "ipaddr.js";
import {
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
} from "@x402/extensions/bazaar";
import {
  PURCHASE_EVIDENCE_RELATION,
  SCHEMAS as POLICY_SCHEMAS,
  createPurchaseEvidenceManifest,
  evaluateResponseContract,
  selectPurchaseEvidenceLink,
  verifyPurchaseEvidenceManifest,
} from "agent-payment-policy";

export const SCHEMA_VERSION = "agent-payment-integrity.audit.v5";
export const TOOL_VERSION = "0.1.0-candidate.9";

const CREDENTIAL_KEY = /(?:^|[-_])(?:api[-_]?key|key|token|secret|password|credential|authorization|auth)(?:$|[-_])/i;
const ROUTE_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*$/;
const DECIMAL_INTEGER = /^(?:0|[1-9][0-9]{0,77})$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_ROUTES = 64;
const SUPPORTED_METHODS = new Set(["GET", "POST"]);
const REQUIRED_PATH = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){0,7}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function lowerAddress(value) {
  if (typeof value !== "string" || !EVM_ADDRESS.test(value) || /^0x0{40}$/i.test(value)) return null;
  return value.toLowerCase();
}

function publicIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function isPublicAddress(address) {
  try {
    const parsed = ipaddr.process(address);
    if (parsed.kind() === "ipv4") return publicIpv4(parsed.toString());
    return parsed.kind() === "ipv6" && parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export function normalizeOrigin(origin) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:"
    || url.port
    || url.pathname !== "/"
    || url.search
    || url.hash
    || url.username
    || url.password
    || !url.hostname.includes(".")
  ) {
    throw new Error("origin must be a credential-free HTTPS origin on port 443");
  }
  if (net.isIP(url.hostname) && !isPublicAddress(url.hostname)) {
    throw new Error("origin address is not public");
  }
  return url;
}

export async function resolvePublicHost(hostname, lookupImpl = dns.lookup) {
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (!isPublicAddress(hostname)) throw new Error("resolved address is not public");
    return [{ address: hostname, family: literalFamily }];
  }
  const results = await lookupImpl(hostname, { all: true, verbatim: true });
  if (!Array.isArray(results) || results.length === 0) throw new Error("hostname did not resolve");
  const normalized = results.map(({ address, family }) => ({ address, family: Number(family) }));
  if (normalized.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("hostname resolved to a non-public address");
  }
  return normalized.sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
}

async function publicDohQuery(hostname, type) {
  const path = `/resolve?name=${encodeURIComponent(hostname)}&type=${type}`;
  const response = await new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: "dns.google",
      servername: "dns.google",
      port: 443,
      path,
      method: "GET",
      maxHeaderSize: 16_384,
      headers: { accept: "application/dns-json", "user-agent": "agent-payment-integrity/0.1" },
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address: "8.8.8.8", family: 4 }]);
        else callback(null, "8.8.8.8", 4);
      },
    }, (result) => {
      const chunks = [];
      let total = 0;
      result.on("data", (chunk) => {
        total += chunk.length;
        if (total > 131_072) request.destroy(new Error("DoH response exceeded byte limit"));
        else chunks.push(chunk);
      });
      result.on("end", () => resolve({ status: result.statusCode, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(5_000, () => request.destroy(new Error("DoH request timed out")));
    request.on("error", reject);
    request.end();
  });
  if (response.status !== 200) throw new Error(`public DNS returned HTTP ${response.status}`);
  const payload = JSON.parse(response.body.toString("utf8"));
  if (payload?.Status !== 0) throw new Error(`public DNS returned status ${payload?.Status}`);
  return (payload.Answer || [])
    .filter((answer) => answer?.type === (type === "A" ? 1 : 28) && typeof answer?.data === "string")
    .map((answer) => ({ address: answer.data, family: type === "A" ? 4 : 6 }));
}

export async function resolvePublicDoh(hostname) {
  if (!/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(hostname)) {
    throw new Error("hostname is not valid for public DNS");
  }
  const records = [...await publicDohQuery(hostname, "A"), ...await publicDohQuery(hostname, "AAAA")];
  if (records.length === 0) throw new Error("public DNS returned no address records");
  if (records.some(({ address }) => !isPublicAddress(address))) throw new Error("public DNS returned a non-public address");
  return records.sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
}

export async function requestPinned(urlInput, {
  lookupImpl = dns.lookup,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  accept = "application/json",
  userAgent = "agent-payment-integrity/0.1",
  publicDns = false,
} = {}) {
  const url = new URL(urlInput);
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) {
    throw new Error("request URL must be credential-free HTTPS on port 443");
  }
  const [{ address, family }] = publicDns
    ? await resolvePublicDoh(url.hostname)
    : await resolvePublicHost(url.hostname, lookupImpl);
  return await new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: url.hostname,
      servername: url.hostname,
      port: 443,
      method: "GET",
      path: `${url.pathname}${url.search}`,
      maxHeaderSize: 65_536,
      headers: { accept, "user-agent": userAgent },
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
    }, (response) => {
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          request.destroy(new Error("response exceeded byte limit"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const status = Number(response.statusCode || 0);
        if (status >= 300 && status < 400) {
          reject(new Error("redirects are not allowed"));
          return;
        }
        resolve({
          status,
          headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? value.join(", ") : String(value ?? ""),
          ])),
          body: Buffer.concat(chunks),
          pinnedAddressFamily: family,
        });
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("request timed out")));
    request.on("error", reject);
    request.end();
  });
}

async function fetchJsonResponse(url, { requestImpl = requestPinned, requestOptions = {} } = {}) {
  const response = await requestImpl(url, requestOptions);
  if (response.status !== 200) throw new Error(`document returned HTTP ${response.status}`);
  try {
    return { document: JSON.parse(response.body.toString("utf8")), response };
  } catch {
    throw new Error("document did not return JSON");
  }
}

async function fetchJson(url, options = {}) {
  return (await fetchJsonResponse(url, options)).document;
}

function parameterExample(parameter) {
  const schema = parameter?.schema || {};
  const declared = parameter?.example ?? schema.example ?? schema.default ?? schema.enum?.[0];
  if (["string", "number", "boolean"].includes(typeof declared)) return String(declared);
  const name = String(parameter?.name || "");
  if (["url", "site", "origin"].includes(name)) return "https://example.com";
  if (name === "domain") return "example.com";
  if (name === "repo") return "expressjs/express";
  if (name === "intent") return "extract a public web page into structured JSON metadata";
  if (name === "address") return `0x${"0".repeat(40)}`;
  if (["marketId", "transactionHash"].includes(name)) return `0x${"0".repeat(64)}`;
  if (["number", "integer"].includes(schema.type)) {
    if (schema.exclusiveMinimum !== undefined) return String(Number(schema.exclusiveMinimum) + 1);
    return String(Number(schema.minimum ?? 0));
  }
  return null;
}

export function buildAuditTarget(origin, route, operation) {
  if (!ROUTE_PATTERN.test(route) || route.includes("{")) throw new Error("unresolved or unsafe route template");
  const target = new URL(route, origin);
  const queryKeys = [];
  for (const parameter of operation?.parameters || []) {
    if (parameter?.in !== "query" || parameter?.required !== true) continue;
    const name = String(parameter.name || "");
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name) || CREDENTIAL_KEY.test(name)) {
      throw new Error(`unsafe required query parameter ${name || "unknown"}`);
    }
    const example = parameterExample(parameter);
    if (example === null) throw new Error(`unresolved required query parameter ${name}`);
    target.searchParams.set(name, example);
    queryKeys.push(name);
  }
  target.searchParams.sort();
  return { url: target, queryKeys: queryKeys.sort() };
}

function decodeJsonBase64(value) {
  if (typeof value !== "string" || value.length < 4 || value.length > 1_000_000) {
    throw new Error("missing or oversized encoded JSON");
  }
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function normalizeEconomics({ amount, currency, asset, recipient, payTo, network, decimals, method, intent, scheme }) {
  const atomic = String(amount ?? "");
  const normalizedAsset = lowerAddress(currency ?? asset) || String(currency ?? asset ?? "").toLowerCase() || null;
  const normalizedRecipient = lowerAddress(recipient ?? payTo);
  return {
    amountAtomic: DECIMAL_INTEGER.test(atomic) ? atomic : null,
    asset: normalizedAsset,
    network: typeof network === "string" ? network.toLowerCase() : null,
    recipient: normalizedRecipient,
    decimals: Number.isInteger(Number(decimals)) ? Number(decimals) : null,
    method: typeof method === "string" ? method.toLowerCase() : null,
    intent: typeof intent === "string" ? intent.toLowerCase() : null,
    scheme: typeof scheme === "string" ? scheme.toLowerCase() : null,
  };
}

function validEconomics(economics) {
  return Boolean(
    economics.amountAtomic
    && BigInt(economics.amountAtomic) > 0n
    && economics.asset
    && economics.network
    && economics.recipient,
  );
}

export function parseX402Challenge(header) {
  try {
    const payload = decodeJsonBase64(header);
    if (payload?.x402Version !== 2 || !Array.isArray(payload.accepts) || payload.accepts.length === 0) {
      throw new Error("unsupported x402 challenge");
    }
    const accepts = payload.accepts.map((offer) => normalizeEconomics({ ...offer, method: "x402", intent: "exact" }));
    if (accepts.some((offer) => !validEconomics(offer))) throw new Error("invalid x402 economics");
    return { payload, accepts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "malformed x402 challenge" };
  }
}

function parseQuotedParameters(value) {
  const parameters = Object.create(null);
  const source = value.replace(/^\s*Payment\s+/i, "");
  const pattern = /([A-Za-z][A-Za-z0-9_-]*)="((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pattern.exec(source))) {
    parameters[match[1].toLowerCase()] = match[2].replace(/\\(["\\])/g, "$1");
  }
  return parameters;
}

export function parseMppChallenges(header) {
  try {
    if (typeof header !== "string" || header.length < 8 || header.length > 1_000_000) {
      throw new Error("missing or oversized MPP challenge");
    }
    const segments = header.split(/,\s*(?=Payment\s)/i).filter(Boolean);
    const offers = segments.map((segment) => {
      const params = parseQuotedParameters(segment);
      if (!params.request || !params.method || !params.intent || !params.realm || !params.expires) {
        throw new Error("MPP challenge parameters missing");
      }
      const expiresAt = Date.parse(params.expires);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error("MPP challenge expired");
      const request = decodeJsonBase64(params.request);
      const network = request.network || (request?.methodDetails?.chainId ? `eip155:${request.methodDetails.chainId}` : null);
      const economics = normalizeEconomics({
        ...request,
        network,
        method: params.method,
        intent: params.intent,
        decimals: request?.methodDetails?.decimals,
      });
      if (!validEconomics(economics)) throw new Error("invalid MPP economics");
      return { ...economics, realm: params.realm.toLowerCase() };
    });
    if (offers.length === 0) throw new Error("no MPP Payment challenge");
    return { offers };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "malformed MPP challenge" };
  }
}

function ajvErrors(errors) {
  return (errors || []).slice(0, 10).map((error) => `${error.instancePath || "/"}:${error.keyword}`);
}

function schemaWithoutFormats(value) {
  if (Array.isArray(value)) return value.map(schemaWithoutFormats);
  if (!isPlainObject(value)) return value;
  const copy = structuredClone(value);
  delete copy.format;
  for (const key of ["additionalProperties", "contains", "else", "if", "items", "not", "propertyNames", "then", "unevaluatedItems", "unevaluatedProperties"]) {
    if (isPlainObject(copy[key])) copy[key] = schemaWithoutFormats(copy[key]);
  }
  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    if (Array.isArray(copy[key])) copy[key] = copy[key].map(schemaWithoutFormats);
  }
  for (const key of ["$defs", "definitions", "dependentSchemas", "patternProperties", "properties"]) {
    if (isPlainObject(copy[key])) {
      copy[key] = Object.fromEntries(Object.entries(copy[key])
        .map(([name, schema]) => [name, schemaWithoutFormats(schema)]));
    }
  }
  return copy;
}

export function validateBazaarContract(extension) {
  const findings = [];
  if (!isPlainObject(extension)) return { valid: false, findings: ["bazaar_extension_missing"] };
  const declared = validateDiscoveryExtension({ ...extension, schema: schemaWithoutFormats(extension.schema) });
  const spec = validateDiscoveryExtensionSpec(extension);
  if (declared.valid !== true) findings.push("bazaar_schema_invalid");
  if (spec.valid !== true) findings.push("bazaar_spec_invalid");

  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true, logger: false });
  addFormats(ajv);
  for (const key of ["input", "output"]) {
    const schema = extension?.schema?.properties?.[key];
    const example = extension?.info?.[key];
    if (!isPlainObject(schema) || example === undefined) {
      findings.push(`bazaar_${key}_example_or_schema_missing`);
      continue;
    }
    const valueSchema = key === "output" ? schema?.properties?.example : schema;
    if (
      key === "output"
      && isPlainObject(example?.example)
      && valueSchema?.type === "object"
      && !isPlainObject(valueSchema?.properties)
      && !Array.isArray(valueSchema?.required)
    ) {
      findings.push("bazaar_output_schema_unconstrained");
    }
    try {
      const validate = ajv.compile(schema);
      if (!validate(example)) findings.push(`bazaar_${key}_example_invalid:${ajvErrors(validate.errors).join("|")}`);
    } catch {
      findings.push(`bazaar_${key}_schema_compile_failed`);
    }
  }
  return { valid: findings.length === 0, findings };
}

function equivalentEconomics(left, right) {
  if (!left || !right) return false;
  const common = ["amountAtomic", "asset", "network", "recipient"];
  if (!common.every((key) => left[key] === right[key])) return false;
  if (left.decimals !== null && right.decimals !== null && left.decimals !== right.decimals) return false;
  return true;
}

function resourceBindsTarget(resourceUrl, target, origin) {
  if (typeof resourceUrl !== "string" || !resourceUrl) return false;
  try {
    if (resourceUrl.startsWith("/")) {
      if (resourceUrl.startsWith("//")) return false;
      return new URL(resourceUrl, origin).toString() === target.toString();
    }
    return new URL(resourceUrl).toString() === target.toString();
  } catch {
    return false;
  }
}

function declaredMppOffers(operation) {
  const offers = operation?.["x-payment-info"]?.offers;
  if (!Array.isArray(offers)) return [];
  return offers.map((offer) => normalizeEconomics({
    ...offer,
    recipient: offer.recipient ?? offer.payTo,
    decimals: offer?.methodDetails?.decimals,
  })).filter(validEconomics);
}

function paidOperations(document, method) {
  const operations = new Map();
  for (const [route, item] of Object.entries(document?.paths || {})) {
    const operation = item?.[method.toLowerCase()];
    if (operation?.["x-payment-info"]) operations.set(route, operation);
  }
  return operations;
}

function responseDeclaration(operation) {
  const responses = isPlainObject(operation?.responses) ? operation.responses : {};
  const status = Object.keys(responses).filter((key) => /^2\d\d$/.test(key)).sort()[0];
  const content = isPlainObject(responses?.[status]?.content) ? responses[status].content : {};
  const key = Object.keys(content).find((item) => item.toLowerCase().split(";", 1)[0].trim() === "application/json");
  const media = isPlainObject(content?.[key]) ? content[key] : null;
  if (!status || !media) return { status: 200, mediaType: "application/json", schema: null };
  const schema = isPlainObject(media.schema) ? media.schema : null;
  let example = media.example;
  if (example === undefined) {
    const first = Object.values(isPlainObject(media.examples) ? media.examples : {})
      .find((item) => isPlainObject(item) && item.value !== undefined);
    example = first?.value;
  }
  if (example === undefined && schema?.example !== undefined) example = schema.example;
  return {
    status: Number(status),
    mediaType: "application/json",
    schema,
    ...(example === undefined ? {} : { example }),
  };
}

function responseContractReport(origin, route, method, operation) {
  return evaluateResponseContract({
    schemaVersion: POLICY_SCHEMAS.responseContractObservation,
    source: "seller_openapi",
    request: { method, url: new URL(route, origin).toString() },
    response: responseDeclaration(operation),
  });
}

function responseContractRepairPlan(operation, requestedPaths, guaranteedPaths) {
  const declaration = responseDeclaration(operation);
  const schema = declaration.schema;
  const guaranteed = new Set(guaranteedPaths);
  const actions = [];

  for (const requiredPath of requestedPaths) {
    if (guaranteed.has(requiredPath)) continue;
    const segments = requiredPath.split(".");
    let current = schema;
    const traversed = [];
    for (const property of segments) {
      const parentPath = traversed.length ? traversed.join(".") : "$";
      if (!isPlainObject(current)) {
        actions.push({
          requiredPath,
          action: "define_nested_property_path",
          parentPath,
          property,
          propertyDeclared: false,
          propertyType: null,
        });
        break;
      }
      const properties = isPlainObject(current.properties) ? current.properties : {};
      const propertySchema = isPlainObject(properties[property]) ? properties[property] : null;
      if (!propertySchema) {
        actions.push({
          requiredPath,
          action: "define_and_require_property",
          parentPath,
          property,
          propertyDeclared: false,
          propertyType: null,
        });
        break;
      }
      const required = Array.isArray(current.required) ? current.required : [];
      if (!required.includes(property)) {
        actions.push({
          requiredPath,
          action: "add_property_to_required",
          parentPath,
          property,
          propertyDeclared: true,
          propertyType: typeof propertySchema.type === "string" ? propertySchema.type : null,
        });
      }
      traversed.push(property);
      current = propertySchema;
    }
  }

  return {
    mode: "advisory_openapi_repair",
    requiredPaths: [...requestedPaths],
    guaranteedPaths: requestedPaths.filter((path) => guaranteed.has(path)),
    actions,
    complete: actions.length === 0,
    boundary: {
      schemaMutationApplied: false,
      propertyTypesInferred: false,
      sellerRuntimeVerified: false,
      statement: "Apply only after the seller confirms each property's real runtime type and semantics, then rerun integrity CI.",
    },
  };
}

function purchaseEvidenceFailure(error) {
  const message = String(error?.message || "");
  if (/same-origin|exactly one|manifest URL|context URL/.test(message)) return "link_invalid";
  if (/unavailable|returned HTTP|did not return JSON|request|timeout|redirect|exceeded/.test(message)) return "document_unavailable";
  if (/schema digest|guarantee|required paths/.test(message)) return "response_contract_mismatch";
  return "contract_invalid";
}

async function purchaseEvidenceObservation({
  base,
  target,
  method,
  requiredPaths,
  responseContract,
  linkHeader,
  manifestLoader,
  source,
} = {}) {
  let manifestUrl;
  try {
    manifestUrl = selectPurchaseEvidenceLink(linkHeader, target);
  } catch (error) {
    return { status: "invalid", reason: purchaseEvidenceFailure(error), source, relation: PURCHASE_EVIDENCE_RELATION };
  }
  if (!manifestUrl) return { status: "missing", source, relation: PURCHASE_EVIDENCE_RELATION };
  if (typeof manifestLoader !== "function") {
    return { status: "unverified", reason: "manifest_loader_missing", source, relation: PURCHASE_EVIDENCE_RELATION, manifestUrl };
  }
  try {
    const manifest = await manifestLoader(manifestUrl);
    const binding = verifyPurchaseEvidenceManifest(manifest, {
      target,
      method,
      requiredPaths: responseContract.requiredPaths,
    });
    const operation = manifest.operations.find((entry) => entry.method === method && entry.path === target.pathname);
    const declaredPaths = [...operation.output.requiredPaths].sort();
    const currentPaths = [...responseContract.requiredPaths].sort();
    if (
      binding.responseSchemaDigest !== responseContract.schemaDigest
      || JSON.stringify(declaredPaths) !== JSON.stringify(currentPaths)
      || !requiredPaths.every((path) => declaredPaths.includes(path))
    ) {
      throw new Error("purchase evidence response schema digest or required paths changed");
    }
    return {
      status: "verified",
      source,
      relation: PURCHASE_EVIDENCE_RELATION,
      manifestUrl,
      manifestDigest: binding.manifestDigest,
      serviceVersion: binding.serviceVersion,
      responseSchemaDigest: binding.responseSchemaDigest,
      requiredPaths: declaredPaths,
      declaration: binding.declaration,
    };
  } catch (error) {
    return { status: "invalid", reason: purchaseEvidenceFailure(error), source, relation: PURCHASE_EVIDENCE_RELATION, manifestUrl };
  }
}

function advertisedProtocols(operation) {
  const protocols = new Set();
  for (const declaration of operation?.["x-payment-info"]?.protocols || []) {
    if (!isPlainObject(declaration)) continue;
    for (const key of Object.keys(declaration)) {
      if (["x402", "mpp"].includes(key.toLowerCase())) protocols.add(key.toLowerCase());
    }
  }
  for (const offer of operation?.["x-payment-info"]?.offers || []) {
    const method = String(offer?.method || "").toLowerCase();
    if (method === "x402") protocols.add("x402");
    if (method === "evm" || method === "tempo" || method === "stripe") protocols.add("mpp");
  }
  return [...protocols].sort();
}

function publicEconomics(offer) {
  return {
    amountAtomic: offer.amountAtomic,
    asset: offer.asset,
    network: offer.network,
    recipient: offer.recipient,
    decimals: offer.decimals,
    method: offer.method,
    intent: offer.intent,
    scheme: offer.scheme,
  };
}

export async function auditIntegrity({
  origin,
  x402Document,
  mppDocument = null,
  requireBazaar = false,
  requirePurchaseEvidence = false,
  purchaseEvidenceLink = null,
  purchaseEvidenceLoader = null,
  route: requestedRoute = null,
  method: requestedMethod = "GET",
  requiredPaths = [],
  maxRoutes = DEFAULT_MAX_ROUTES,
  requestImpl = requestPinned,
} = {}) {
  const base = normalizeOrigin(origin);
  if (!isPlainObject(x402Document)) throw new Error("x402 OpenAPI document is required");
  const method = String(requestedMethod).toUpperCase();
  if (!SUPPORTED_METHODS.has(method)) throw new Error("method must be GET or POST");
  if (!Array.isArray(requiredPaths) || requiredPaths.length > 16) {
    throw new Error("requiredPaths must contain at most 16 dotted paths");
  }
  const normalizedRequiredPaths = [...new Set(requiredPaths.map((path) => String(path).trim()))].sort();
  if (normalizedRequiredPaths.some((path) => !REQUIRED_PATH.test(path))) {
    throw new Error("requiredPaths must contain safe dotted JSON paths");
  }
  if (!Number.isInteger(maxRoutes) || maxRoutes < 1 || maxRoutes > DEFAULT_MAX_ROUTES) {
    throw new Error(`maxRoutes must be an integer from 1 to ${DEFAULT_MAX_ROUTES}`);
  }
  if (
    requestedRoute !== null
    && (
      !ROUTE_PATTERN.test(requestedRoute)
      || !requestedRoute.startsWith("/")
      || requestedRoute.startsWith("//")
      || requestedRoute.includes("{")
    )
  ) {
    throw new Error("route must be one exact absolute path without parameters, query, or fragment");
  }
  const xOperations = paidOperations(x402Document, method);
  const mppOperations = mppDocument ? paidOperations(mppDocument, method) : new Map();
  const availableRoutes = [...new Set([...xOperations.keys(), ...mppOperations.keys()])].sort();
  const routeNames = requestedRoute === null
    ? availableRoutes
    : availableRoutes.filter((candidate) => candidate === requestedRoute);
  if (requestedRoute !== null && routeNames.length === 0) throw new Error(`exact paid ${method} route was not declared`);
  if (routeNames.length > maxRoutes) throw new Error(`paid ${method} route count exceeds ${maxRoutes}`);
  const routes = [];

  for (const route of routeNames) {
    const operation = xOperations.get(route) || mppOperations.get(route);
    const findings = [];
    const responseContract = responseContractReport(base, route, method, operation);
    const repairPlan = responseContractRepairPlan(operation, normalizedRequiredPaths, responseContract.requiredPaths);
    if (responseContract.decision !== "admissible") {
      findings.push(`seller_response_contract_${responseContract.decision}`);
    }
    for (const path of normalizedRequiredPaths) {
      if (!responseContract.requiredPaths.includes(path)) findings.push(`seller_response_required_path_missing:${path}`);
    }

    if (method === "POST") {
      const target = new URL(route, base);
      const purchaseEvidence = await purchaseEvidenceObservation({
        base,
        target,
        method,
        requiredPaths: normalizedRequiredPaths,
        responseContract,
        linkHeader: purchaseEvidenceLink,
        manifestLoader: purchaseEvidenceLoader,
        source: "openapi_entrypoint",
      });
      if (purchaseEvidence.status === "invalid") findings.push(`purchase_evidence_${purchaseEvidence.reason}`);
      if (requirePurchaseEvidence && purchaseEvidence.status !== "verified") findings.push("purchase_evidence_required");
      routes.push({
        method,
        route,
        status: null,
        queryKeys: [],
        valid: findings.length === 0,
        runtimeChallengeVerified: false,
        probe: { attempted: false, reason: "post_requires_explicit_non_secret_fixture" },
        findings,
        protocols: [...new Set([
          ...advertisedProtocols(xOperations.get(route)),
          ...advertisedProtocols(mppOperations.get(route)),
        ])].sort(),
        economics: null,
        discovery: { bazaar: { present: null, valid: null } },
        responseContract,
        repairPlan,
        purchaseEvidence,
      });
      continue;
    }
    let target;
    let queryKeys = [];
    try {
      ({ url: target, queryKeys } = buildAuditTarget(base, route, operation));
    } catch (error) {
      routes.push({
        method,
        route,
        status: null,
        queryKeys,
        valid: false,
        runtimeChallengeVerified: false,
        probe: { attempted: false, reason: "target_not_constructible" },
        findings: [`target_invalid:${error.message}`],
        protocols: [],
      });
      continue;
    }

    let response;
    try {
      response = await requestImpl(target, { accept: "application/json" });
    } catch {
      routes.push({ method, route, status: null, queryKeys, valid: false, runtimeChallengeVerified: false, probe: { attempted: true, reason: "request_failed" }, findings: ["credential_free_probe_failed"], protocols: [] });
      continue;
    }
    if (response.status !== 402) findings.push(`expected_402_received_${response.status}`);

    const livePurchaseLink = response.headers?.link || null;
    const purchaseEvidence = await purchaseEvidenceObservation({
      base,
      target,
      method,
      requiredPaths: normalizedRequiredPaths,
      responseContract,
      linkHeader: livePurchaseLink,
      manifestLoader: purchaseEvidenceLoader,
      source: "runtime_402",
    });
    if (purchaseEvidence.status === "invalid") findings.push(`purchase_evidence_${purchaseEvidence.reason}`);
    if (requirePurchaseEvidence && purchaseEvidence.status !== "verified") findings.push("purchase_evidence_required");

    const x402 = parseX402Challenge(response.headers?.["payment-required"] || response.headers?.["x-payment-required"]);
    const mpp = parseMppChallenges(response.headers?.["www-authenticate"]);
    const protocols = [];
    let bazaarObservation = { present: false, valid: null };

    if (x402.error) findings.push("x402_challenge_invalid");
    else {
      protocols.push("x402");
      const resourceUrl = x402.payload?.resource?.url;
      if (!resourceBindsTarget(resourceUrl, target, base)) findings.push("x402_full_request_binding_mismatch");
      const bazaarExtension = x402.payload?.extensions?.bazaar;
      const bazaar = bazaarExtension === undefined
        ? { present: false, valid: null, findings: requireBazaar ? ["bazaar_extension_missing"] : [] }
        : { present: true, ...validateBazaarContract(bazaarExtension) };
      bazaarObservation = { present: bazaar.present, valid: bazaar.valid };
      findings.push(...bazaar.findings);
    }

    const mppDeclared = declaredMppOffers(mppOperations.get(route));
    const expectsMpp = mppOperations.has(route) || mppDeclared.length > 0;
    if (mpp.error) {
      if (expectsMpp) findings.push("mpp_challenge_invalid");
    } else {
      protocols.push("mpp");
      if (mpp.offers.some((offer) => offer.realm !== base.hostname.toLowerCase())) {
        findings.push("mpp_realm_mismatch");
      }
    }

    if (!x402.error && !mpp.error) {
      const xOffer = x402.accepts[0];
      const evmOffer = mpp.offers.find((offer) => offer.method === "evm") || mpp.offers[0];
      if (!equivalentEconomics(xOffer, evmOffer)) findings.push("x402_mpp_economics_mismatch");
      const declaredEvm = mppDeclared.find((offer) => offer.method === "evm");
      const declaredX402 = mppDeclared.find((offer) => offer.method === "x402");
      if (declaredEvm && !equivalentEconomics(declaredEvm, evmOffer)) findings.push("mpp_declaration_runtime_mismatch");
      if (declaredX402 && !equivalentEconomics(declaredX402, xOffer)) findings.push("x402_declaration_runtime_mismatch");
    }

    routes.push({
      method,
      route,
      status: response.status,
      queryKeys,
      valid: findings.length === 0,
      runtimeChallengeVerified: response.status === 402,
      probe: { attempted: true, reason: null },
      findings,
      protocols: [...new Set(protocols)].sort(),
      economics: {
        x402: x402.error ? null : publicEconomics(x402.accepts[0]),
        mpp: mpp.error ? null : publicEconomics(mpp.offers.find((offer) => offer.method === "evm") || mpp.offers[0]),
      },
      discovery: {
        bazaar: bazaarObservation,
      },
      responseContract,
      repairPlan,
      purchaseEvidence,
    });
  }

  const invalidRoutes = routes.filter((entry) => !entry.valid).length;
  const machineBuyable = invalidRoutes === 0 && routes.length > 0 && routes.every((entry) => entry.runtimeChallengeVerified);
  return {
    schemaVersion: SCHEMA_VERSION,
    checkedAt: new Date().toISOString(),
    origin: base.origin,
    versions: {
      x402: x402Document?.info?.version || null,
      mpp: mppDocument?.info?.version || null,
    },
    selection: {
      route: requestedRoute,
      method,
      requiredPaths: normalizedRequiredPaths,
      maxRoutes,
      availableRouteCount: availableRoutes.length,
    },
    routeCount: routes.length,
    validRoutes: routes.length - invalidRoutes,
    invalidRoutes,
    ok: invalidRoutes === 0 && routes.length > 0,
    machineBuyable,
    routes,
    safety: {
      credentialsUsed: false,
      paymentSigned: false,
      paymentSent: false,
      redirectsAllowed: false,
      dnsPinned: true,
      rawPaymentHeadersRetained: false,
      opaqueStateRetained: false,
      queryValuesRetained: false,
    },
    policy: { requireBazaar, requirePurchaseEvidence },
    boundary: "Unpaid point-in-time contract integrity only. No claim about settlement, paid delivery, catalog indexing, identity, or future availability.",
  };
}

export async function auditOrigin({
  origin,
  x402Path = "/openapi.json",
  mppPath = "/mpp-openapi.json",
  requestImpl = requestPinned,
  publicDns = false,
  requireBazaar = false,
  requirePurchaseEvidence = false,
  route = null,
  method = "GET",
  requiredPaths = [],
  maxRoutes = DEFAULT_MAX_ROUTES,
} = {}) {
  const base = normalizeOrigin(origin);
  const requestOptions = { userAgent: "agent-payment-integrity/0.1", publicDns };
  const x402Result = await fetchJsonResponse(new URL(x402Path, base), { requestImpl, requestOptions });
  const x402Document = x402Result.document;
  let mppDocument = null;
  let mppResponse = null;
  try {
    const mppResult = await fetchJsonResponse(new URL(mppPath, base), { requestImpl, requestOptions });
    mppDocument = mppResult.document;
    mppResponse = mppResult.response;
  } catch (error) {
    if (!String(error?.message).includes("HTTP 404")) throw error;
  }
  const boundRequest = (url, options = {}) => requestImpl(url, { ...requestOptions, ...options });
  const x402Link = x402Result.response.headers?.link || null;
  const mppLink = mppResponse?.headers?.link || null;
  if (x402Link && mppLink) {
    const x402Manifest = selectPurchaseEvidenceLink(x402Link, base);
    const mppManifest = selectPurchaseEvidenceLink(mppLink, base);
    if (x402Manifest !== mppManifest) throw new Error("OpenAPI entry points advertise different purchase evidence manifests");
  }
  const entryPurchaseEvidenceLink = x402Link || mppLink;
  const manifestCache = new Map();
  const purchaseEvidenceLoader = async (url) => {
    if (!manifestCache.has(url)) {
      manifestCache.set(url, fetchJson(url, {
        requestImpl,
        requestOptions: { ...requestOptions, maxBytes: 512_000 },
      }));
    }
    return manifestCache.get(url);
  };
  const report = await auditIntegrity({
    origin: base,
    x402Document,
    mppDocument,
    requireBazaar,
    requirePurchaseEvidence,
    purchaseEvidenceLink: entryPurchaseEvidenceLink,
    purchaseEvidenceLoader,
    route,
    method,
    requiredPaths,
    maxRoutes,
    requestImpl: boundRequest,
  });
  report.safety.dnsMode = publicDns ? "explicit-public-doh" : "system-resolver";
  return report;
}

export function createPurchaseEvidenceScaffold({
  report,
  serviceVersion,
  assertReadOnlyPost = false,
} = {}) {
  if (!isPlainObject(report) || report.schemaVersion !== SCHEMA_VERSION || report.ok !== true) {
    throw new Error("a passing agent-payment-integrity audit report is required");
  }
  const origin = normalizeOrigin(report.origin).origin;
  const version = String(serviceVersion || "").trim();
  if (!version || version.length > 100) throw new Error("serviceVersion is required and must be at most 100 characters");
  if (!Array.isArray(report.routes) || report.routes.length < 1 || report.routes.length > 100) {
    throw new Error("audit report must contain 1 to 100 routes");
  }
  const protocols = [...new Set(report.routes.flatMap((route) => route.protocols || []))].sort();
  if (!protocols.length || protocols.some((protocol) => !["mpp", "x402"].includes(protocol))) {
    throw new Error("audit report has no supported payment protocol");
  }
  const operations = report.routes.map((route) => {
    const method = String(route?.method || "").toUpperCase();
    if (!route?.valid || !["GET", "POST"].includes(method)) {
      throw new Error("every scaffolded route must be a valid GET or POST audit result");
    }
    if (method === "POST" && assertReadOnlyPost !== true) {
      throw new Error("POST scaffolding requires an explicit read-only assertion");
    }
    if (method === "POST" && (report.routes.length !== 1 || report.selection?.route !== route.route)) {
      throw new Error("POST scaffolding requires one exact explicitly selected route");
    }
    if (route.responseContract?.decision !== "admissible") {
      throw new Error("every scaffolded route requires an admissible response contract");
    }
    return {
      method,
      path: route.route,
      effect: "read_only",
      output: {
        mediaType: "application/json",
        schemaDigest: route.responseContract.schemaDigest,
        requiredPaths: route.responseContract.requiredPaths,
        declaration: "seller_declared",
      },
      replay: {},
      receipt: { runtimeValidationRequired: true },
    };
  });
  return createPurchaseEvidenceManifest({
    service: { origin, version },
    protocols,
    evidence: {},
    operations,
    boundary: {
      claims: "seller_declared_until_independently_verified",
      authorization: "This manifest is evidence for a separate buyer policy decision and is not permission to spend.",
      runtime: "The buyer must still verify the live payment challenge, paid response, receipt, settlement, and required output.",
      scaffold: "Generated from one passing credential-free point-in-time audit. Review, serve from the same origin, advertise the exact relation, and rerun integrity CI before release.",
    },
  });
}

export function toSarif(report) {
  const results = report.routes.flatMap((route) => route.findings.map((finding) => ({
    ruleId: finding.split(":", 1)[0],
    level: "error",
    message: { text: `${route.method || "GET"} ${route.route}: ${finding}` },
    locations: [{ physicalLocation: { artifactLocation: { uri: report.origin + route.route } } }],
  })));
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [{
      tool: { driver: { name: "agent-payment-integrity", version: TOOL_VERSION, rules: [] } },
      results,
    }],
  };
}
