// SSRF-guarded fetch for the audit engine.
// Blocks private/reserved/metadata targets, revalidates every redirect hop,
// and caps redirects, time, response size, URL length, and destination ports.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = Number(process.env.MAX_REDIRECTS ?? 5);
const MAX_RESPONSE_BYTES = Number(process.env.MAX_RESPONSE_BYTES ?? 5 * 1024 * 1024);
const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS ?? 15000);
const MAX_URL_LENGTH = Number(process.env.MAX_URL_LENGTH ?? 2048);
const ALLOWED_PORTS = new Set(
  (process.env.ALLOWED_TARGET_PORTS ?? "80,443").split(",").map((p) => p.trim())
);
// The audit engine parses HTML; anything else is billed-for noise.
const ALLOWED_CONTENT_TYPES = /^(text\/html|application\/xhtml\+xml|text\/plain)\b/i;

export class AuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

function isPrivateIpv4(ip) {
  const o = ip.split(".").map(Number);
  return (
    o[0] === 0 ||                          // 0.0.0.0/8
    o[0] === 10 ||                         // 10/8
    o[0] === 127 ||                        // loopback
    (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || // 100.64/10 CGNAT
    (o[0] === 169 && o[1] === 254) ||      // link-local (incl. cloud metadata)
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||  // 172.16/12
    (o[0] === 192 && o[1] === 168) ||      // 192.168/16
    (o[0] === 192 && o[1] === 0 && (o[2] === 0 || o[2] === 2)) || // 192.0.0/24, 192.0.2/24
    (o[0] === 198 && (o[1] === 18 || o[1] === 19)) || // 198.18/15 benchmarking
    (o[0] === 203 && o[1] === 0 && o[2] === 113) ||   // 203.0.113/24 documentation
    o[0] >= 224                            // multicast + reserved 224/3
  );
}

function isPrivateIp(ip) {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) {
    const low = ip.toLowerCase();
    // IPv4-mapped, dotted form (::ffff:a.b.c.d)
    const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    // IPv4-mapped, hex form (::ffff:a00:1) — convert last 32 bits to dotted
    const hexMapped = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    // NAT64 well-known prefix 64:ff9b::/96 can smuggle IPv4 targets
    if (low.startsWith("64:ff9b:")) return true;
    return (
      low === "::" || low === "::1" ||
      low.startsWith("fe8") || low.startsWith("fe9") ||
      low.startsWith("fea") || low.startsWith("feb") || // fe80::/10 link-local
      low.startsWith("fc") || low.startsWith("fd") ||   // fc00::/7 ULA
      low.startsWith("ff") ||                           // multicast
      low.startsWith("2001:db8")                        // documentation
    );
  }
  return true; // not a recognizable IP — treat as unsafe
}

// Structural checks shared by initial validation and every redirect hop.
function assertSafeUrlShape(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuditError("UNSUPPORTED_SCHEME", `Unsupported scheme: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new AuditError("URL_CREDENTIALS_NOT_ALLOWED", "URLs with embedded credentials are not allowed");
  }
  const bare = url.hostname.replace(/^\[|\]$/g, "");
  if (bare === "localhost" || bare.endsWith(".localhost") || bare.endsWith(".local") || bare.endsWith(".internal")) {
    throw new AuditError("PRIVATE_ADDRESS_BLOCKED", "Local or internal hostnames are not allowed");
  }
  if (isIP(bare) && isPrivateIp(bare)) {
    throw new AuditError("PRIVATE_ADDRESS_BLOCKED", "Private or reserved IP addresses are not allowed");
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (!ALLOWED_PORTS.has(port)) {
    throw new AuditError("UNSUPPORTED_PORT", `Destination port ${port} is not allowed`);
  }
}

export async function assertPublicHost(hostname) {
  const bare = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (isIP(bare)) return; // literal IPs already checked structurally
  let addrs;
  try {
    addrs = await lookup(bare, { all: true, verbatim: true });
  } catch {
    throw new AuditError("TARGET_UNREACHABLE", `Could not resolve host: ${bare}`);
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new AuditError("PRIVATE_ADDRESS_BLOCKED", "Host resolves to a private or reserved address");
    }
  }
}

async function readCapped(res, maxBytes = MAX_RESPONSE_BYTES) {
  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > maxBytes) {
    throw new AuditError("RESPONSE_TOO_LARGE", `Response exceeds ${maxBytes} byte limit`);
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new AuditError("RESPONSE_TOO_LARGE", `Response exceeds ${maxBytes} byte limit`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Cheap synchronous validation (no DNS): parseability, length, scheme, ports,
// credentials, and literal local/private hosts. Lets routes reject obvious
// garbage before rate limiting.
export function validateTarget(rawUrl) {
  const raw = String(rawUrl).trim();
  if (raw.length > MAX_URL_LENGTH) {
    throw new AuditError("URL_TOO_LONG", `URL exceeds ${MAX_URL_LENGTH} characters`);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    throw new AuditError("UNSUPPORTED_SCHEME", `Unsupported scheme: ${raw.split(":")[0]}:`);
  }
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new AuditError("INVALID_URL", "Not a parseable URL");
  }
  assertSafeUrlShape(url);
  return url;
}

// Fetch with per-hop SSRF validation. Returns { response, body, finalUrl }.
export async function safeFetch(rawUrl, headers = {}, options = {}) {
  let url = validateTarget(rawUrl);
  const timeoutMs = Number(options.timeoutMs ?? AUDIT_TIMEOUT_MS);
  const maxResponseBytes = Number(options.maxResponseBytes ?? MAX_RESPONSE_BYTES);
  const maxRedirects = Number(options.maxRedirects ?? MAX_REDIRECTS);
  const allowedContentTypes = options.allowedContentTypes ?? ALLOWED_CONTENT_TYPES;
  const method = String(options.method ?? "GET").toUpperCase();
  const deadline = AbortSignal.timeout(timeoutMs);
  const started = performance.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    assertSafeUrlShape(url); // re-check scheme/port/credentials/host on every hop
    await assertPublicHost(url.hostname);

    let res;
    try {
      res = await fetch(url, {
        headers,
        method,
        body: options.body,
        redirect: "manual",
        signal: deadline,
      });
    } catch (e) {
      if (e.name === "TimeoutError" || deadline.aborted) {
        throw new AuditError("AUDIT_TIMEOUT", "Target site took too long to respond");
      }
      throw new AuditError("TARGET_UNREACHABLE", `Could not connect to ${url.hostname}`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      res.body?.cancel().catch(() => {});
      if (method !== "GET" && method !== "HEAD") {
        throw new AuditError("UNSAFE_REDIRECT", "Redirects for non-GET discovery requests are not followed");
      }
      let next;
      try {
        next = new URL(res.headers.get("location"), url);
      } catch {
        throw new AuditError("INVALID_URL", "Redirect target is not a parseable URL");
      }
      url = next; // next loop iteration revalidates shape + host
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !allowedContentTypes.test(contentType)) {
      res.body?.cancel().catch(() => {});
      throw new AuditError("UNSUPPORTED_CONTENT_TYPE", `Cannot audit content type: ${contentType.split(";")[0]}`);
    }

    const ttfbMs = Math.round(performance.now() - started);
    const body = await readCapped(res, maxResponseBytes);
    return { response: res, body, finalUrl: url.href, ttfbMs, totalMs: Math.round(performance.now() - started) };
  }
  throw new AuditError("TOO_MANY_REDIRECTS", `Exceeded ${maxRedirects} redirects`);
}
