// Canonical x402 Bazaar discovery identity for every paid Santos endpoint.
//
// Why this module exists: the x402 SDK derives a resource's catalog identity
// from the LIVE REQUEST URL unless a route pins it —
// `url: routeConfig.resource || adapter.getUrl()` (@x402/core server + http).
// Every paid route here is query-driven (`?url=...`), so without a pin each
// request minted a *different* resource.url and the Bazaar catalog never saw a
// stable resource to index. Pinning `resource` to the values below is what
// makes the eleven endpoints eleven durable catalog entries.
//
// Rules this module enforces (see tests/bazaar-discovery.test.js):
//   - Every paid route gets its own resource URL. No route may borrow another's,
//     and none may fall back to the API root.
//   - Resource URLs are canonical and query-free, so identity is stable across
//     callers regardless of which target URL they audit.
//   - Tags stay within the Bazaar limit (MAX_TAGS = 5 in @x402/extensions);
//     extras are silently dropped by the SDK, so the cap is enforced here.

// Base is env-overridable so preview and local runs can advertise themselves,
// but production always falls back to the canonical API host.
export const RESOURCE_BASE_URL = (
  process.env.X402_RESOURCE_BASE_URL || "https://api.santosautomation.com"
).replace(/\/+$/, "");

// One seller identity across the catalog: the eleven resources are distinct
// products of a single service, and resource.url is what keeps them distinct.
export const BAZAAR_SERVICE_NAME = "Santos Website Intelligence";

// Square eagle emblem (18KB PNG) served from the marketing host.
export const BAZAAR_ICON_URL = "https://www.santosautomation.com/apple-icon.png";

// Bazaar drops tags beyond this count without warning.
export const MAX_BAZAAR_TAGS = 5;

// The eleven paid endpoints. `path` doubles as the verbless route key each
// route file registers with x402HTTPResourceServer, so the pinned resource URL
// and the paywall key can never drift apart.
//
// `methods` lists every payable verb the route exports. The SDK overwrites
// info.input.method with the live request method, so a route serving both GET
// and POST must declare each shape separately (query params vs JSON body) to
// stay coherent — `style` records which shape belongs to which verb.
export const BAZAAR_ROUTES = [
  {
    id: "safe-fetch",
    path: "/v1/fetch",
    methods: ["GET", "POST"],
    style: { GET: "query", POST: "body" },
    tags: ["web-intelligence", "web-fetch", "http-client", "ssrf-safe"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
  {
    id: "extract",
    path: "/v1/extract",
    methods: ["GET", "POST"],
    style: { GET: "query", POST: "body" },
    tags: ["web-intelligence", "markdown-extraction", "content-extraction", "rag"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
  {
    id: "structured-extract",
    path: "/v1/extract/structured",
    methods: ["POST"],
    style: { POST: "body" },
    tags: ["web-intelligence", "structured-data", "json-schema", "llm-extraction"],
    probe: {
      method: "POST",
      body: {
        url: "https://example.com",
        schema: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
      },
    },
  },
  {
    id: "screenshot",
    path: "/v1/screenshot",
    methods: ["GET"],
    style: { GET: "query" },
    tags: ["web-intelligence", "screenshot", "pdf-render", "headless-browser"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
  {
    id: "feed",
    path: "/v1/feed",
    methods: ["GET", "POST"],
    style: { GET: "query", POST: "body" },
    tags: ["web-intelligence", "rss", "atom", "json-feed"],
    probe: { method: "GET", query: { url: "https://example.com/feed.xml" } },
  },
  {
    id: "links",
    path: "/v1/links",
    methods: ["GET", "POST"],
    style: { GET: "query", POST: "body" },
    tags: ["web-intelligence", "link-analysis", "site-map", "site-discovery"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
  {
    id: "summarize",
    path: "/v1/summarize",
    methods: ["GET", "POST"],
    style: { GET: "query", POST: "body" },
    tags: ["web-intelligence", "web-summary", "llm", "content-extraction"],
    probe: { method: "POST", body: { url: "https://example.com" } },
  },
  {
    id: "deep-audit",
    path: "/v1/audits",
    methods: ["POST"],
    style: { POST: "body" },
    tags: ["website-audit", "lighthouse", "accessibility", "security-headers"],
    probe: {
      method: "POST",
      body: { url: "https://example.com", devices: ["mobile"], modules: ["lighthouse"] },
    },
  },
  {
    id: "quick-audit",
    path: "/api/audit",
    methods: ["GET"],
    style: { GET: "query" },
    tags: ["website-audit", "seo", "accessibility", "performance"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
  {
    id: "batch-audit",
    path: "/api/audit/batch",
    methods: ["POST"],
    style: { POST: "body" },
    tags: ["website-audit", "batch-audit", "bulk", "seo"],
    probe: { method: "POST", body: { urls: ["https://example.com"] } },
  },
  {
    id: "agent-readiness",
    path: "/api/agent-readiness",
    methods: ["GET"],
    style: { GET: "query" },
    tags: ["agent-readiness", "llms-txt", "openapi", "mcp"],
    probe: { method: "GET", query: { url: "https://example.com" } },
  },
];

const BY_ID = new Map(BAZAAR_ROUTES.map((route) => [route.id, route]));

/**
 * Look up a paid route's catalog entry, failing loudly on an unknown id so a
 * typo in a route file surfaces at boot rather than as a missing listing.
 */
export function bazaarRoute(id) {
  const route = BY_ID.get(id);
  if (!route) throw new Error(`Unknown Bazaar route id: ${id}`);
  return route;
}

/** The canonical, query-free resource URL a route must pin. */
export function resourceUrl(id) {
  return `${RESOURCE_BASE_URL}${bazaarRoute(id).path}`;
}

/**
 * The shared resource metadata block for a route config. Spread this into the
 * route's config so `resource`, `serviceName`, `iconUrl`, and `tags` come from
 * one place. Tags are copied per call — never hand a route a shared array it
 * could mutate into another route's listing.
 */
export function bazaarResourceMeta(id) {
  const route = bazaarRoute(id);
  return {
    resource: resourceUrl(id),
    serviceName: BAZAAR_SERVICE_NAME,
    iconUrl: BAZAAR_ICON_URL,
    tags: [...route.tags],
  };
}
