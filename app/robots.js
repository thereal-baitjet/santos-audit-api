import { SITE_URL } from "../lib/marketing-content.js";

export default function robots() {
  return {
    rules: [{
      userAgent: "*",
      // Open by default: public API and machine-readable surfaces (/api/*,
      // /v1/*, llms.txt, openapi.json, capability manifests, /mcp) stay
      // discoverable and callable by robots-respecting agent tools.
      allow: "/",
      disallow: ["/_next/", "/admin/"],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: new URL(SITE_URL).hostname,
  };
}
