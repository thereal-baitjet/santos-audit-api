import { SITE_URL } from "../lib/marketing-content.js";

export default function robots() {
  return {
    rules: [{
      userAgent: "*",
      // RFC 9309 longest-match-wins: the explicit Allow entries below beat the
      // shorter Disallow prefixes, so paid/product endpoints stay callable by
      // robots-respecting agent tools while unlisted internals stay disallowed.
      allow: [
        "/", "/llms.txt", "/openapi.json", "/capabilities.json",
        "/.well-known/agent-capabilities.json",
        "/api/audit", "/api/audit/demo", "/api/agent-readiness",
        "/v1/audits", "/v1/extract", "/v1/extract/structured", "/v1/fetch", "/v1/screenshot", "/mcp",
      ],
      disallow: ["/api/", "/v1/", "/_next/"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: new URL(SITE_URL).hostname,
  };
}
