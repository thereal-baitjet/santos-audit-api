// Minimal stateless MCP server (Streamable HTTP transport, JSON responses).
// Exposes audit_website_preview — the FREE limited tier (1/day per IP, shared
// with /api/audit/demo). Unlimited audits are paid via the x402 HTTP endpoint,
// which the tool description and results disclose explicitly.
import { NextResponse } from "next/server";
import { auditSite } from "../../audit.js";
import { AuditError, validateTarget } from "../../lib/safe-fetch.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../lib/demo-limit.js";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";

// Newest first. Initialize negotiates: requested if supported, else our latest.
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"];

const ALLOWED_ORIGINS = new Set(
  [
    "https://www.santosautomation.com",
    "https://santosautomation.com",
    "https://api.santosautomation.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.MCP_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ].filter(Boolean)
);

const TOOL = {
  name: "audit_website_preview",
  description:
    "FREE PREVIEW (1 audit per day per IP) of the Santos Site Audit API. Runs a fast, lightweight audit of a single public web page: fetch-timing and page-weight performance signals, SEO signals (title, meta description, headings, canonical, OpenGraph), basic HTML accessibility signals (alt text, lang, viewport), and security-header checks (HTTPS, HSTS, CSP). Returns 0-100 category scores, individual pass/fail checks, and plain-English remediation guidance. It audits one page only — no crawling, JavaScript rendering, Core Web Vitals, WCAG conformance, or vulnerability scanning. " +
    `For unlimited audits, use the machine-payable production endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... — $0.005 USDC per successful audit on Base mainnet (eip155:8453) via x402 v2; no account or API key required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "A publicly reachable HTTP or HTTPS page.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
};

const rpcResult = (id, result) => NextResponse.json({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message, status = 200) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

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
  if (!(await hasFreeAudit(ip))) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: `RATE_LIMITED: the free preview is 1 audit/day per IP. For unlimited audits use the x402 endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... ($0.005 USDC on Base mainnet).`,
      }],
    };
  }
  try {
    const report = await auditSite(args.url.trim());
    await markFreeAudit(ip);
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
  // Streamable HTTP security: reject browser requests from unknown origins.
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  let msg;
  try {
    msg = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "Batch requests are not supported");
  const { id, method, params } = msg ?? {};

  // After initialization, clients send MCP-Protocol-Version; reject unsupported.
  const declaredVersion = req.headers.get("mcp-protocol-version");
  if (method !== "initialize" && declaredVersion && !SUPPORTED_PROTOCOL_VERSIONS.includes(declaredVersion)) {
    return rpcError(id, -32000, `Unsupported MCP protocol version: ${declaredVersion}. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`, 400);
  }

  // Notifications get an empty 202 per Streamable HTTP.
  if (method?.startsWith("notifications/")) return new NextResponse(null, { status: 202 });

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: { tools: {} },
        serverInfo: { name: "santos-site-audit", version: "2.0.0" },
        instructions:
          "Use audit_website_preview for a free (1/day per IP) lightweight single-page audit. Unlimited audits are available via the x402-paid HTTP endpoint documented in the tool description.",
      });
    }
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
