// Minimal stateless MCP server (Streamable HTTP transport, JSON responses).
// Exposes audit_website_preview — the FREE limited tier (1/day per IP, shared
// with /api/audit/demo). Paid tools return canonical x402 HTTP handoffs so MCP
// cannot bypass the resource server's verification and settlement flow.
import { NextResponse } from "next/server";
import { auditSite } from "../../audit.js";
import { AuditError, validateTarget } from "../../lib/safe-fetch.js";
import { hasFreeAudit, markFreeAudit, ipFromRequest } from "../../lib/demo-limit.js";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";
import { AGENT_READINESS_RESULT_SCHEMA } from "../../lib/agent-readiness/contract.js";
import { getAgentReadinessPriceUsdc } from "../../lib/agent-readiness/product-pricing.js";

const AGENT_READINESS_PRICE = getAgentReadinessPriceUsdc();

// Newest first. Initialize negotiates: requested if supported, else our latest.
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const ALLOWED_ORIGINS = new Set(
  [
    "https://www.santosautomation.com",
    "https://www.santosautomation.com",
    "https://api.santosautomation.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.MCP_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ].filter(Boolean)
);

const PREVIEW_TOOL = {
  name: "audit_website_preview",
  description:
    "FREE PREVIEW (1 audit per day per IP) of Santos Website Intelligence. Runs a fast Quick Intelligence Audit of one public page: fetch timing, page weight, SEO, basic HTML accessibility, security headers, Website Intelligence dimensions, pass/fail checks, and remediation guidance. It audits one page only—no crawling, JavaScript rendering, Core Web Vitals, WCAG certification, or vulnerability scanning. " +
    `For unlimited audits, use the machine-payable production endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... — $0.015 USDC per successful audit on Base mainnet (eip155:8453) via x402 v2; no account or API key required.`,
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
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const AGENT_READINESS_TOOL = {
  name: "audit_agent_readiness",
  description: `PAID CAPABILITY ($${AGENT_READINESS_PRICE} USDC per successful audit via x402 v2). Passively assesses how well a public website or service can be discovered, understood, invoked, and—where explicitly applicable—paid by agents. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the versioned result are exchanged at GET ${PUBLIC_API_BASE_URL}/api/agent-readiness?url=...&depth=quick. No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS target." },
      depth: { type: "string", enum: ["quick"], default: "quick" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: AGENT_READINESS_RESULT_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
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
        text: `RATE_LIMITED: the free preview is 1 audit/day per IP. For unlimited audits use the x402 endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... ($0.015 USDC on Base mainnet).`,
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

function callAgentReadinessTool(args) {
  if (!args || typeof args.url !== "string" || !args.url.trim() || (args.depth && args.depth !== "quick")) {
    return { isError: true, content: [{ type: "text", text: "INVALID_ARGUMENTS: 'url' is required and depth, when supplied, must be 'quick'." }] };
  }
  try {
    const target = validateTarget(args.url.trim()).href;
    const endpoint = `${PUBLIC_API_BASE_URL}/api/agent-readiness?url=${encodeURIComponent(target)}&depth=quick`;
    return {
      isError: true,
      content: [{
        type: "text",
        text: `PAYMENT_REQUIRED: Agent Readiness costs $${AGENT_READINESS_PRICE} USDC per successful audit on Base mainnet via x402 v2. Request ${endpoint} without a signature to receive PAYMENT-REQUIRED terms, then sign and retry with PAYMENT-SIGNATURE.`,
      }],
    };
  } catch (error) {
    const code = error instanceof AuditError ? error.code : "AUDIT_FAILED";
    return { isError: true, content: [{ type: "text", text: `${code}: ${error.message}` }] };
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
        serverInfo: { name: "santos-website-intelligence", version: "2.3.1" },
        instructions:
          `Use audit_website_preview for a free (1/day per IP) lightweight page audit. Agent Readiness is a paid $${AGENT_READINESS_PRICE} USDC capability; audit_agent_readiness validates the target and returns its canonical x402 HTTP handoff.`,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: [PREVIEW_TOOL, AGENT_READINESS_TOOL] });
    case "tools/call": {
      if (params?.name === PREVIEW_TOOL.name) return rpcResult(id, await callAuditTool(params?.arguments, ipFromRequest(req)));
      if (params?.name === AGENT_READINESS_TOOL.name) return rpcResult(id, await callAgentReadinessTool(params?.arguments));
      return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// A human clicking this link from the capabilities manifest gets a friendly
// explainer instead of a bare 405. MCP clients use POST (unchanged).
export async function GET(req) {
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const explainer = {
    service: "Santos Website Intelligence — Model Context Protocol (MCP) endpoint",
    transport: "MCP over Streamable HTTP. Send JSON-RPC 2.0 requests via POST to this URL.",
    methods: ["initialize", "tools/list", "tools/call", "ping"],
    tools: ["audit_website_preview (free, 1/day per IP)", "audit_agent_readiness (paid via x402, returns the canonical HTTP handoff)"],
    for_humans: `${PUBLIC_API_BASE_URL}/agent-readiness/buy — buy a $19 Agent Readiness Report by card, no account`,
    docs: {
      openapi: `${PUBLIC_API_BASE_URL}/openapi.json`,
      llms_txt: `${PUBLIC_API_BASE_URL}/llms.txt`,
      capabilities: `${PUBLIC_API_BASE_URL}/capabilities.json`,
    },
  };
  if (wantsHtml) {
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Santos MCP endpoint</title>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:6vh auto;padding:0 20px;background:#0b0d10;color:#e8e6e1">
<h1 style="color:#d4a24e">Santos MCP endpoint</h1>
<p>This is a <strong>Model Context Protocol</strong> endpoint. Automated clients talk to it with JSON-RPC 2.0 over HTTP <strong>POST</strong> (Streamable HTTP transport) — there is nothing to see here in a browser.</p>
<p>Tools: <code>audit_website_preview</code> (free, 1/day per IP) and <code>audit_agent_readiness</code> (paid via x402).</p>
<p><strong>Just want a report?</strong> <a href="${PUBLIC_API_BASE_URL}/agent-readiness/buy" style="color:#d4a24e">Buy an Agent Readiness Report for $19 by card →</a></p>
<p>Machine-readable: <a href="${PUBLIC_API_BASE_URL}/openapi.json" style="color:#d4a24e">OpenAPI</a> · <a href="${PUBLIC_API_BASE_URL}/llms.txt" style="color:#d4a24e">llms.txt</a> · <a href="${PUBLIC_API_BASE_URL}/capabilities.json" style="color:#d4a24e">capabilities.json</a></p>
</body>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600", Allow: "GET, POST" } });
  }
  return NextResponse.json(explainer, { status: 200, headers: { "Cache-Control": "public, max-age=3600", Allow: "GET, POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
