// Remediation generators for failed AI Readiness layers.
//
// Pure and stateless: no network access, so a caller can never make this
// route fetch anything (no SSRF surface), and the same input always yields
// byte-identical output that can be cached or diffed between re-audits.
//
//   discoverable / callable fail → llms.txt (llmstxt.org format)
//   understandable fail          → schema.org Organization JSON-LD
//
// Input is validated in full before anything is generated; every problem is
// reported at once (field + message) rather than one per round trip.

export const LAYERS = ["discoverable", "understandable", "callable"] as const;
export type Layer = (typeof LAYERS)[number];

export const METHODS = ["GET", "POST"] as const;
export type HttpMethod = (typeof METHODS)[number];

export interface EndpointInput {
  path: string;
  method: HttpMethod;
  desc: string;
}

export interface RemediateRequest {
  domain: string;
  siteDescription: string;
  failedLayers: Layer[];
  existingEndpoints: EndpointInput[];
}

/** A domain reduced to what the generators need: no path, query, or credentials. */
export interface Site {
  hostname: string;
  origin: string;
  name: string;
}

export interface IssueDetail {
  field: string;
  message: string;
}

export type RemediationErrorCode =
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "INVALID_REPORT"
  | "REPORT_DOMAIN_MISMATCH"
  | "REPORT_ALLOWANCE_USED"
  | "REPORT_PUBLISHED"
  | "REPORT_CHECK_UNAVAILABLE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE";

const STATUS_BY_CODE: Record<RemediationErrorCode, number> = {
  INVALID_JSON: 400,
  INVALID_REQUEST: 400,
  INVALID_REPORT: 403,
  REPORT_DOMAIN_MISMATCH: 403,
  REPORT_ALLOWANCE_USED: 403,
  REPORT_PUBLISHED: 403,
  REPORT_CHECK_UNAVAILABLE: 503,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
};

export class RemediationError extends Error {
  readonly code: RemediationErrorCode;
  readonly status: number;
  readonly details: IssueDetail[];

  constructor(code: RemediationErrorCode, message: string, details: IssueDetail[] = []) {
    super(message);
    this.name = "RemediationError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const LIMITS = Object.freeze({
  domain: 253,
  siteDescription: 1000,
  endpoints: 100,
  path: 512,
  endpointDesc: 300,
});

// ── Sanitation ──────────────────────────────────────────────────────────────

// C0/C1 controls, zero-width and bidi-override characters, BOM, and the
// Unicode line/paragraph separators. Any of them can break a Markdown line or
// hide text from a human reviewer (Trojan Source-style), so they become spaces.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2028\u2029\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** NFC-normalise, neutralise unsafe characters, and collapse to one line. */
export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim();
}

/** Escape characters that would end or nest Markdown link text. */
function escapeLinkText(text: string): string {
  return text.replace(/([\\[\]])/g, "\\$1");
}

/**
 * Escape free text for llms.txt prose. Backslash-escaping "[" "]" means no
 * caller text can form a link (e.g. a javascript: URL), and "<" ">" means no
 * raw HTML survives a Markdown renderer. Readers still see the literal text.
 */
function escapeProse(text: string): string {
  return text.replace(/([\\[\]<>])/g, "\\$1");
}

/**
 * Serialise for embedding inside <script type="application/ld+json">.
 * "<" is escaped so a description containing "</script>" cannot close the tag;
 * ">" and "&" likewise so the HTML parser never sees markup. U+2028/2029 are
 * stripped by cleanText already but escaped here too as defence in depth.
 */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// ── Validation ──────────────────────────────────────────────────────────────

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
// RFC 3986 path characters plus "{}" for templated paths. Excludes "()[]<>",
// whitespace, "?" and "#", so a path can never break the Markdown link grammar.
// "%" only as a complete percent-escape, so every emitted URL is well-formed.
const PATH = /^\/(?!\/)(?:[A-Za-z0-9\-._~!$&'*+,;=:@/{}]|%[0-9A-Fa-f]{2})*$/;

/** Accepts "example.com" or "https://example.com[/]"; rejects IPs, paths, credentials. */
export function normalizeDomain(raw: string): Site {
  const trimmed = raw.trim();
  if (!trimmed) throw new RemediationError("INVALID_REQUEST", "domain is required.", [{ field: "domain", message: "must be a non-empty hostname" }]);

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const invalid = (message: string) =>
    new RemediationError("INVALID_REQUEST", `Invalid domain: ${message}`, [{ field: "domain", message }]);

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw invalid("not a parseable hostname");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw invalid("scheme must be http or https");
  if (url.username || url.password) throw invalid("must not contain credentials");
  if (url.pathname !== "/" || url.search || url.hash) throw invalid("must be a bare domain without path, query, or fragment");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!HOSTNAME.test(hostname)) throw invalid("must be a public DNS hostname, not an IP address or single label");

  return { hostname, origin: url.origin, name: hostname.replace(/^www\./, "") };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Validate an untrusted JSON body into a typed, sanitised request. */
export function parseRemediateRequest(body: unknown): { request: RemediateRequest; site: Site } {
  if (!isRecord(body)) {
    throw new RemediationError("INVALID_REQUEST", "Request body must be a JSON object.", [{ field: "(body)", message: "expected an object" }]);
  }
  const issues: IssueDetail[] = [];

  // domain
  let site: Site | null = null;
  if (typeof body.domain !== "string") issues.push({ field: "domain", message: "must be a string" });
  else if (body.domain.length > LIMITS.domain) issues.push({ field: "domain", message: `must be at most ${LIMITS.domain} characters` });
  else {
    try {
      site = normalizeDomain(body.domain);
    } catch (e) {
      if (!(e instanceof RemediationError)) throw e;
      issues.push(...e.details);
    }
  }

  // siteDescription
  let siteDescription = "";
  if (typeof body.siteDescription !== "string") issues.push({ field: "siteDescription", message: "must be a string" });
  else {
    siteDescription = cleanText(body.siteDescription);
    if (!siteDescription) issues.push({ field: "siteDescription", message: "must not be empty" });
    else if (siteDescription.length > LIMITS.siteDescription) {
      issues.push({ field: "siteDescription", message: `must be at most ${LIMITS.siteDescription} characters` });
    }
  }

  // failedLayers
  const failedLayers: Layer[] = [];
  if (!Array.isArray(body.failedLayers) || body.failedLayers.length === 0) {
    issues.push({ field: "failedLayers", message: `must be a non-empty array of ${LAYERS.join(", ")}` });
  } else {
    body.failedLayers.forEach((layer: unknown, i: number) => {
      if (!LAYERS.includes(layer as Layer)) {
        issues.push({ field: `failedLayers[${i}]`, message: `must be one of ${LAYERS.join(", ")}` });
      } else if (!failedLayers.includes(layer as Layer)) {
        failedLayers.push(layer as Layer);
      }
    });
  }

  // existingEndpoints (optional; defaults to none)
  const existingEndpoints: EndpointInput[] = [];
  const rawEndpoints = body.existingEndpoints ?? [];
  if (!Array.isArray(rawEndpoints)) issues.push({ field: "existingEndpoints", message: "must be an array" });
  else if (rawEndpoints.length > LIMITS.endpoints) {
    issues.push({ field: "existingEndpoints", message: `must contain at most ${LIMITS.endpoints} entries` });
  } else {
    const seen = new Set<string>();
    rawEndpoints.forEach((ep: unknown, i: number) => {
      const at = `existingEndpoints[${i}]`;
      if (!isRecord(ep)) return void issues.push({ field: at, message: "must be an object" });

      const { path, method, desc } = ep;
      let ok = true;
      if (typeof path !== "string" || path.length > LIMITS.path || !PATH.test(path)) {
        issues.push({ field: `${at}.path`, message: `must be an absolute path starting with "/" (max ${LIMITS.path} chars, no query, fragment, spaces, or brackets)` });
        ok = false;
      }
      if (!METHODS.includes(method as HttpMethod)) {
        issues.push({ field: `${at}.method`, message: `must be one of ${METHODS.join(", ")}` });
        ok = false;
      }
      const cleanDesc = typeof desc === "string" ? cleanText(desc) : null;
      if (cleanDesc === null) {
        issues.push({ field: `${at}.desc`, message: "must be a string" });
        ok = false;
      } else if (cleanDesc.length > LIMITS.endpointDesc) {
        issues.push({ field: `${at}.desc`, message: `must be at most ${LIMITS.endpointDesc} characters` });
        ok = false;
      }
      if (!ok) return;

      const endpoint: EndpointInput = { path: path as string, method: method as HttpMethod, desc: cleanDesc as string };
      const key = `${endpoint.method} ${endpoint.path}`;
      if (seen.has(key)) return; // first occurrence wins; duplicates waste an agent's context
      seen.add(key);
      existingEndpoints.push(endpoint);
    });
  }

  if (issues.length || !site) {
    throw new RemediationError("INVALID_REQUEST", "Request validation failed.", issues);
  }
  return {
    request: { domain: site.hostname, siteDescription, failedLayers, existingEndpoints },
    site,
  };
}

// ── Generators ──────────────────────────────────────────────────────────────
// Both accept a domain string ("example.com" or an origin) and normalise it,
// and generateLlmsText drops any endpoint whose path or method would not pass
// parseRemediateRequest, so both are safe to call directly.

/**
 * llms.txt per https://llmstxt.org: an H1 with the site name (the only
 * required element), a blockquote summary, a free-form detail paragraph, then
 * H2 sections of "- [title](url): notes" links. Endpoints go under "## API" —
 * the section an agent evaluating callability reads first.
 */
export function generateLlmsText(domain: string, siteDescription: string, endpoints: readonly EndpointInput[]): string {
  const site = normalizeDomain(domain);
  const summary = escapeProse(cleanText(siteDescription));
  const lines: string[] = [`# ${site.name}`, ""];
  if (summary) lines.push(`> ${summary}`, "");
  lines.push(`All URLs below are absolute; the canonical origin is ${site.origin}.`, "");

  const callable = endpoints.filter(
    (ep) => METHODS.includes(ep.method) && ep.path.length <= LIMITS.path && PATH.test(ep.path)
  );
  if (callable.length) {
    lines.push("## API", "");
    for (const ep of callable) {
      const note = escapeProse(cleanText(ep.desc));
      const title = escapeLinkText(`${ep.method} ${ep.path}`);
      lines.push(`- [${title}](${site.origin}${ep.path})${note ? `: ${note}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Optional", "", `- [Home](${site.origin}/): Human-facing homepage`, "");
  return lines.join("\n").trimEnd() + "\n";
}

export interface JsonLdArtifact {
  /** The structured data itself, for callers that render their own tag. */
  data: Record<string, unknown>;
  /** A ready-to-paste <script> element, safe to place in <head>. */
  script: string;
}

/** schema.org Organization, the entity the Understandable layer looks for. */
export function generateJsonLdSchema(domain: string, siteDescription: string): JsonLdArtifact {
  const site = normalizeDomain(domain);
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.origin}/#organization`,
    name: site.name,
    url: `${site.origin}/`,
    description: cleanText(siteDescription),
  };
  return {
    data,
    script: `<script type="application/ld+json">\n${jsonForScript(data)}\n</script>`,
  };
}

// ── Orchestration ───────────────────────────────────────────────────────────

export interface RemediationResponse {
  domain: string;
  origin: string;
  failedLayers: Layer[];
  artifacts: {
    llmsTxt: { addresses: Layer[]; path: "/llms.txt"; contentType: string; content: string } | null;
    jsonLd: { addresses: Layer[]; placement: "head"; content: string; data: Record<string, unknown> } | null;
  };
  warnings: string[];
}

export function buildRemediation(request: RemediateRequest, site: Site): RemediationResponse {
  const failed = new Set(request.failedLayers);
  const llmsLayers = request.failedLayers.filter((l) => l === "discoverable" || l === "callable");
  const warnings: string[] = [];

  if (failed.has("callable") && request.existingEndpoints.length === 0) {
    warnings.push("callable failed but no existingEndpoints were supplied, so llms.txt has no API section; document at least one endpoint to address this layer.");
  }

  const jsonLd = failed.has("understandable") ? generateJsonLdSchema(site.origin, request.siteDescription) : null;

  return {
    domain: site.hostname,
    origin: site.origin,
    failedLayers: request.failedLayers,
    artifacts: {
      llmsTxt: llmsLayers.length
        ? {
            addresses: llmsLayers,
            path: "/llms.txt",
            contentType: "text/markdown; charset=utf-8",
            content: generateLlmsText(site.origin, request.siteDescription, request.existingEndpoints),
          }
        : null,
      jsonLd: jsonLd
        ? { addresses: ["understandable"], placement: "head", content: jsonLd.script, data: jsonLd.data }
        : null,
    },
    warnings,
  };
}
