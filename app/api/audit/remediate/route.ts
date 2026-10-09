import { withAgentLog } from "../../../../lib/agent-log.js";
// POST /api/audit/remediate: llms.txt + Organization JSON-LD for failed AI
// Readiness layers, x402-paid or free with a signed private report. The
// handler lives in lib/remediate-http.ts so tests can inject a facilitator;
// this file owns the route's Bazaar listing.
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { resourceServer } from "../../../../lib/x402-server.js";
import { bazaarResourceMeta } from "../../../../lib/bazaar-catalog.js";
import { createRemediateHandler, remediateOptions } from "../../../../lib/remediate-http.ts";

export const dynamic = "force-dynamic";

const catalog = {
  "/api/audit/remediate": {
    ...bazaarResourceMeta("remediate"),
    extensions: {
      ...declareDiscoveryExtension({
        bodyType: "json",
        input: {
          domain: "example.com",
          siteDescription: "Example sells widgets.",
          failedLayers: ["discoverable", "understandable"],
          existingEndpoints: [{ path: "/api/products", method: "GET", desc: "List products" }],
        },
        inputSchema: {
          properties: {
            domain: { type: "string", description: "Bare domain or origin, e.g. example.com." },
            siteDescription: { type: "string", description: "One or two sentences on what the site is; max 1000 characters." },
            failedLayers: { type: "array", items: { type: "string", enum: ["discoverable", "understandable", "callable"] }, minItems: 1 },
            existingEndpoints: { type: "array", maxItems: 100, items: { type: "object", properties: { path: { type: "string" }, method: { type: "string", enum: ["GET", "POST"] }, desc: { type: "string" } } } },
          },
          required: ["domain", "siteDescription", "failedLayers"],
        },
        output: {
          example: {
            domain: "example.com",
            origin: "https://example.com",
            failedLayers: ["discoverable", "understandable"],
            artifacts: {
              llmsTxt: { addresses: ["discoverable"], path: "/llms.txt", contentType: "text/markdown; charset=utf-8", content: "# example.com\n\n> Example sells widgets.\n" },
              jsonLd: { addresses: ["understandable"], placement: "head", content: "<script type=\"application/ld+json\">…</script>" },
            },
            warnings: [],
            access: { mode: "x402" },
          },
        },
      }),
    },
  },
};

export const OPTIONS = remediateOptions;
export const POST = withAgentLog(createRemediateHandler(resourceServer, catalog), "remediate");
