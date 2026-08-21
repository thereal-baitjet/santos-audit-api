import { withAgentLog } from "../../lib/agent-log.js";
import { NextResponse } from "next/server";
import { openapiDocument } from "../../lib/openapi-document.js";

async function handleGET() {
  return NextResponse.json(openapiDocument, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}

export const GET = withAgentLog(handleGET, "openapi-spec");
