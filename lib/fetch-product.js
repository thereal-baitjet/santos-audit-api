// Safe Fetch product engine: the battle-tested safe-fetcher sold directly.
// One public URL in → raw text body + response metadata out, with the same
// guarantees as every other tier: SSRF guards (private/link-local/metadata
// blocked, re-checked on every redirect hop), 15s timeout, 5 redirects,
// 5MB cap, ports 80/443 only. Text formats only — this returns JSON.
import { safeFetch } from "./safe-fetch.js";

export const SAFE_FETCH_SCHEMA_VERSION = "1.0.0";
const UA = "SantosFetchBot/1.0 (+https://santosautomation.com)";
// 2MB (vs the fetcher's 5MB default): keeps worst-case egress at ~5x margin
// on the $0.002 price while still covering any realistic text resource.
const MAX_BODY_BYTES = Number(process.env.SAFE_FETCH_MAX_BYTES ?? 2 * 1024 * 1024);

// Broader than the audit tiers: agents fetch JSON APIs, feeds, sitemaps,
// and scripts as often as pages. Binary formats stay excluded.
export const FETCH_CONTENT_TYPES =
  /^(text\/|application\/(json|ld\+json|xml|xhtml\+xml|rss\+xml|atom\+xml|javascript|x-javascript)\b|image\/svg\+xml)/i;

const ECHOED_HEADERS = [
  "content-type", "content-language", "last-modified", "etag",
  "cache-control", "expires", "content-encoding", "server", "x-robots-tag",
];

// Pure response shaper, exported for tests.
export function shapeFetchResponse({ response, body, finalUrl, ttfbMs, totalMs }, requestedUrl) {
  const headers = {};
  for (const name of ECHOED_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return {
    schema_version: SAFE_FETCH_SCHEMA_VERSION,
    url: requestedUrl,
    final_url: finalUrl,
    http_status: response.status,
    content_type: response.headers.get("content-type") ?? null,
    headers,
    body,
    body_bytes: Buffer.byteLength(body ?? "", "utf-8"),
    fetched_at: new Date().toISOString(),
    timing_ms: { ttfb: ttfbMs, total: totalMs },
  };
}

export async function fetchUrl(rawUrl) {
  const result = await safeFetch(rawUrl, { "user-agent": UA, accept: "*/*" }, {
    allowedContentTypes: FETCH_CONTENT_TYPES,
    maxResponseBytes: MAX_BODY_BYTES,
  });
  return shapeFetchResponse(result, rawUrl);
}
