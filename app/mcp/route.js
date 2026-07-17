// Minimal stateless MCP server (Streamable HTTP transport, JSON responses).
// Exposes one tool: audit_website. Free-preview tier shares the demo limiter;
// unlimited paid access is via the x402 HTTP endpoint (see tool description).
import { NextResponse } from "next/server";
import { auditSite } from "../../audit.js";
import { AuditError, validateTarget } from "../../lib/safe-fetch.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../lib/demo-limit.js";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";

const PROTOCOL_VERSION = "2025-03-26";

const TOOL = {
  name: "audit_website",
  description:
    "Audit a public website for performance, SEO, accessibility, and security. Returns category scores (0-100), detailed checks, detected issues, and actionable plain-English remediation guidance. " +
    "This MCP tool is a free preview limited to 1 audit per day per IP. For unlimited audits, use the machine-payable HTTP endpoint instead: " +
    `GET ${PUBLIC_API_BASE_URL}/api/audit?url=... — $0.005 USDC per audit on Base mainnet via the x402 protocol, no account or API key required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "A publicly reachable HTTP or HTTPS website URL.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

const rpcResult = (id, result) => NextResponse.json({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function callAuditTool(args, ip) {
  if (!args || typeof args.url !== "string" || !args.url.trim()) {
    return { isError: true, content: [{ type: "text", text: "INVALID_URL: a non-empty 'url' string argument is required." }] };
  }
  try {
    validateTarget(args.url.trim()); // reject invalid/blocked targets before rate limiting
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "INVALID_URL";
    return { isError: true, content: [{ type: "text", text: `${code}: ${e.message}` }] };
  }
  if (!hasFreeAudit(ip)) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `RATE_LIMITED: the free MCP preview is 1 audit/day per IP. For unlimited audits use the x402 endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... ($0.005 USDC on Base).`,
      }],
    };
  }
  try {
    const report = await auditSite(args.url.trim());
    markFreeAudit(ip);
    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
      structuredContent: report,
    };
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "AUDIT_FAILED";
    return { isError: true, content: [{ type: "text", text: `${code}: ${e.message}` }] };
  }
}

export async function POST(req) {
  let msg;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "Batch requests are not supported");
  const { id, method, params } = msg ?? {};

  // Notifications get an empty 202 per Streamable HTTP.
  if (method?.startsWith("notifications/")) return new NextResponse(null, { status: 202 });

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "santos-site-audit", version: "1.0.0" },
        instructions:
          "Use audit_website to get a scored technical review of any public website. Free preview: 1 audit/day per IP; unlimited via the x402-paid HTTP endpoint documented in the tool description.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: [TOOL] });
    case "tools/call": {
      if (params?.name !== TOOL.name) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
      return rpcResult(id, await callAuditTool(params?.arguments, ipFromRequest(req)));
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// Stateless server: no SSE stream, no sessions.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
