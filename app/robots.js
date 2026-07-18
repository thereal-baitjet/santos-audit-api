import { SITE_URL } from "../lib/marketing-content.js";

export default function robots() {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/llms.txt", "/openapi.json", "/capabilities.json", "/.well-known/agent-capabilities.json"],
      disallow: ["/api/", "/v1/", "/mcp", "/_next/"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
