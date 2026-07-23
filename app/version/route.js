// GET /version — machine-readable version and contract reference. JSON so
// agents can pin against schema versions; humans get the same pretty output.
import { NextResponse } from "next/server";
import { AGENT_READINESS_SCHEMA_VERSION } from "../../lib/agent-readiness/contract.js";
import { WEBSITE_INTELLIGENCE_SCHEMA_VERSION } from "../../lib/website-intelligence.js";
import { REPORT_SCHEMA_VERSION } from "../../lib/deep/schemas.js";

const SITE = "https://www.santosautomation.com";
const API = "https://api.santosautomation.com";

export function GET() {
  return NextResponse.json(
    {
      product: "Santos Website Intelligence API",
      api_version: "2.9.0",
      schema_versions: {
        agent_readiness: AGENT_READINESS_SCHEMA_VERSION,
        website_intelligence: WEBSITE_INTELLIGENCE_SCHEMA_VERSION,
        deep_report: REPORT_SCHEMA_VERSION,
      },
      contracts: {
        openapi: `${API}/openapi.json`,
        llms_txt: `${API}/llms.txt`,
        capability_manifest: `${API}/capabilities.json`,
        well_known_capability_manifest: `${SITE}/.well-known/agent-capabilities.json`,
        mcp: `${API}/mcp`,
      },
      status: `${SITE}/status`,
      changelog: `${SITE}/changelog`,
      support: "info@santosautomation.com",
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } }
  );
}
