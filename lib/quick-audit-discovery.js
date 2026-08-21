// Bazaar discovery declaration for GET /api/audit. Output schema is the same
// object as the OpenAPI 200 contract. routeTemplate is the official catalog
// identity; the x402 challenge resource.url is the live invocation.
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { auditReportExample, auditReportSchema } from "./audit-report-schema.js";
import { bazaarRouteTemplate } from "./bazaar-catalog.js";

export function quickAuditDiscoveryExtensions() {
  const declared = declareDiscoveryExtension({
    input: { url: "https://example.com" },
    inputSchema: {
      properties: {
        url: { type: "string", description: "The public HTTP or HTTPS website URL to audit." },
      },
      required: ["url"],
    },
    output: {
      example: auditReportExample,
      schema: auditReportSchema,
    },
  });
  return {
    bazaar: {
      ...declared.bazaar,
      routeTemplate: bazaarRouteTemplate("quick-audit"),
    },
  };
}
