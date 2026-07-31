import { withAgentLog } from "../../lib/agent-log.js";
// Minimal stateless MCP server (Streamable HTTP transport, JSON responses).
//
// audit_website_preview is the one free surface left on the whole service: a
// single real audit per day per IP, so an agent that discovers this server can
// judge the output before being asked to pay. Every other tool returns a
// canonical x402 HTTP handoff, so MCP cannot bypass the resource server's
// verification and settlement flow.
import { NextResponse } from "next/server";
import { auditSite } from "../../audit.js";
import { AuditError, validateTarget } from "../../lib/safe-fetch.js";
import { openPreviewQuota, ipFromRequest, FREE_TIER_HELP } from "../../lib/demo-limit.js";
import { PUBLIC_API_BASE_URL } from "../../lib/base-url.js";
import { apiProduct } from "../../lib/products.js";

// Quoted price resolves from the canonical catalog, never a literal.
const QUICK_PRICE = apiProduct("/api/audit").priceUsdc;
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

// Output schemas. MCP clients use these to parse a result structurally instead
// of scraping the text block, so every tool that returns structuredContent
// declares one that matches what it actually returns.
//
// The paid tools return a payment handoff rather than data, so they share
// PAYMENT_HANDOFF_SCHEMA — previously audit_agent_readiness advertised the full
// audit result schema for a response that never contains an audit.
const PAYMENT_HANDOFF_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    payment_required: { type: "boolean", const: true },
    protocol: { type: "string", description: "x402-v2" },
    method: { type: "string", description: "HTTP method to use for the paid request." },
    url: { type: "string", format: "uri", description: "Exact URL to request, then pay for and retry." },
    price_usdc: { type: "string", description: "Price in USDC for one successful call." },
    network: { type: "string", description: "CAIP-2 chain id, eip155:8453 (Base mainnet)." },
    settles: { type: "string", description: "When funds move." },
  },
  required: ["payment_required", "protocol", "method", "url", "price_usdc", "network"],
});

const QUICK_AUDIT_OUTPUT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    schema_version: { type: "string" },
    url: { type: "string", format: "uri" },
    fetched_at: { type: "string", format: "date-time" },
    http_status: { type: "integer" },
    timing_ms: { type: "object" },
    overall_score: { type: "integer", minimum: 0, maximum: 100 },
    scores: { type: "object", description: "performance, seo, accessibility, security (0-100 each)." },
    checks: { type: "object", description: "Individual pass/fail checks with detail." },
    website_intelligence_score: { type: "integer", minimum: 0, maximum: 100 },
    website_intelligence: { type: "object", description: "Discoverable, Understandable, Callable, Trustworthy." },
    issues: { type: "array", items: { type: "string" } },
    audited_by: { type: "string" },
  },
  required: ["schema_version", "url", "overall_score", "scores", "website_intelligence_score", "issues"],
});

const PREVIEW_TOOL = {
  name: "audit_website_preview",
  description:
    "FREE PREVIEW (1 audit per day per caller IP) of Santos Website Intelligence. Runs a fast Quick Intelligence Audit of one public page: fetch timing, page weight, SEO, basic HTML accessibility, security headers, Website Intelligence dimensions, pass/fail checks, and remediation guidance. It audits one page only—no crawling, JavaScript rendering, Core Web Vitals, WCAG certification, or vulnerability scanning. " +
    "Note for hosted agents: the quota is keyed on the calling IP, so all users of one platform share a single daily preview. Treat it as a sample of the output, not as capacity. " +
    `For real use, call the machine-payable production endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... — $${QUICK_PRICE} USDC per successful audit on Base mainnet (eip155:8453) via x402 v2; no account or API key required.`,
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
  outputSchema: QUICK_AUDIT_OUTPUT_SCHEMA,
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
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const EXTRACT_PRICE = process.env.EXTRACT_PRICE_USDC ?? "0.005";

const EXTRACT_TOOL = {
  name: "extract_page_markdown",
  description: `PAID CAPABILITY ($${EXTRACT_PRICE} USDC per successful extraction via x402 v2). Fetches one public page and returns its main content as clean Markdown plus title, description, outbound links, and word count. Single page only — no crawling or JavaScript rendering. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the result are exchanged at GET ${PUBLIC_API_BASE_URL}/v1/extract?url=... (or POST {"url": "…"}). No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS page." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const STRUCTURED_EXTRACT_PRICE = process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08";

const STRUCTURED_EXTRACT_TOOL = {
  name: "extract_structured_data",
  description: `PAID CAPABILITY ($${STRUCTURED_EXTRACT_PRICE} USDC per successful schema-conforming extraction via x402 v2). Fetches one public page and returns JSON fields extracted by an LLM against your own JSON Schema, re-validated against that schema before return; non-conforming output returns 422 and never settles. Single page only — no crawling or JavaScript rendering; page content is truncated to 8000 characters. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the result are exchanged at POST ${PUBLIC_API_BASE_URL}/v1/extract/structured with {"url": "…", "schema": {...}} — POST only, because a JSON Schema does not fit in a query string. No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS page." },
      schema: { type: "object", description: "Optional here — the handoff is returned either way. Required on the paid POST: a self-contained JSON Schema (type: object, no $ref) describing the fields to extract. Max 4000 characters." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const FEED_PRICE = process.env.FEED_PRICE_USDC ?? "0.003";
const LINKS_PRICE = process.env.LINKS_PRICE_USDC ?? "0.003";
const SUMMARIZE_PRICE = process.env.SUMMARIZE_PRICE_USDC ?? "0.033";

const FEED_PARSE_TOOL = {
  name: "feed_parse",
  description: `PAID CAPABILITY ($${FEED_PRICE} USDC per successful parse via x402 v2). Parses one public feed URL (RSS 2.0, Atom, or JSON Feed) into normalized JSON with feed metadata and up to 50 items; non-feed targets return 422 and never settle. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the result are exchanged at GET ${PUBLIC_API_BASE_URL}/v1/feed?url=... (or POST {"url": "…"}). No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS feed URL." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const LINK_MAP_TOOL = {
  name: "link_map",
  description: `PAID CAPABILITY ($${LINKS_PRICE} USDC per successful link map via x402 v2). Maps one public HTML page's links into a categorized link map — kind internal/external plus topic tags (docs, pricing, api, careers, social, feed) with per-category counts, up to 200 links. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the result are exchanged at GET ${PUBLIC_API_BASE_URL}/v1/links?url=... (or POST {"url": "…"}). No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS page." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

const SUMMARIZE_TOOL = {
  name: "summarize",
  description: `PAID CAPABILITY ($${SUMMARIZE_PRICE} USDC per successful summary via x402 v2). Summarizes one public HTML page into a Claude-generated structured summary (title, summary, key_facts, entities, word_count) with an optional focus steering prompt; non-HTML targets return 422 and never settle. This MCP call validates the target and returns the canonical x402 HTTP handoff; payment and the result are exchanged at POST ${PUBLIC_API_BASE_URL}/v1/summarize with {"url": "…"} (or GET ?url=&focus=). No account or API key is required.`,
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri", description: "A publicly reachable HTTP or HTTPS page." },
      focus: { type: "string", description: "Optional steering prompt for the summary, e.g. \"pricing plans\"." },
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: PAYMENT_HANDOFF_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

// Paid-handoff tools: validate the target, then return the canonical x402 HTTP
// handoff — MCP never executes or settles the paid call itself.
function callPaidHandoffTool(args, { name, path, price }) {
  if (!args || typeof args.url !== "string" || !args.url.trim()) {
    return { isError: true, content: [{ type: "text", text: "INVALID_URL: a non-empty 'url' string argument is required." }] };
  }
  try {
    const target = validateTarget(args.url.trim()).href;
    const endpoint = `${PUBLIC_API_BASE_URL}${path}?url=${encodeURIComponent(target)}`;
    return {
      isError: true,
      content: [{
        type: "text",
        text: `PAYMENT_REQUIRED: ${name} costs $${price} USDC per successful call on Base mainnet via x402 v2. Request ${endpoint} without a signature to receive PAYMENT-REQUIRED terms, then sign and retry with PAYMENT-SIGNATURE. A POST variant with a JSON body is paywalled identically.`,
      }],
      structuredContent: {
        payment_required: true,
        protocol: "x402-v2",
        method: "GET",
        url: endpoint,
        price_usdc: price,
        network: "eip155:8453",
        settles: "only on a successful (2xx) response",
      },
    };
  } catch (error) {
    const code = error instanceof AuditError ? error.code : "INVALID_URL";
    return { isError: true, content: [{ type: "text", text: `${code}: ${error.message}` }] };
  }
}

// Structured extraction is POST-only — a JSON Schema does not fit in a query
// string — so it needs its own handoff shape rather than the shared ?url= form.
function callStructuredExtractHandoff(args) {
  if (!args || typeof args.url !== "string" || !args.url.trim()) {
    return { isError: true, content: [{ type: "text", text: "INVALID_URL: a non-empty 'url' string argument is required." }] };
  }
  try {
    const target = validateTarget(args.url.trim()).href;
    const endpoint = `${PUBLIC_API_BASE_URL}/v1/extract/structured`;
    return {
      isError: true,
      content: [{
        type: "text",
        text: `PAYMENT_REQUIRED: Structured Extraction costs $${STRUCTURED_EXTRACT_PRICE} USDC per successful call on Base mainnet via x402 v2. POST ${endpoint} with {"url": ${JSON.stringify(target)}, "schema": {…}} and no signature to receive PAYMENT-REQUIRED terms, then sign and retry with PAYMENT-SIGNATURE. Output that does not conform to your schema returns 422 and never settles.`,
      }],
      structuredContent: {
        payment_required: true,
        protocol: "x402-v2",
        method: "POST",
        url: endpoint,
        price_usdc: STRUCTURED_EXTRACT_PRICE,
        network: "eip155:8453",
        settles: "only on a successful (2xx) response",
      },
    };
  } catch (error) {
    const code = error instanceof AuditError ? error.code : "INVALID_URL";
    return { isError: true, content: [{ type: "text", text: `${code}: ${error.message}` }] };
  }
}

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
  const gate = await openPreviewQuota(ip);
  if (!gate.ok) {
    return {
      isError: true,
      content: [{
        type: "text",
        text:
          `RATE_LIMITED: the free preview is 1 audit/day per IP, and a hosted agent shares that address with every other user of the platform. ` +
          `For unlimited audits use the x402 endpoint: GET ${PUBLIC_API_BASE_URL}/api/audit?url=... ($${QUICK_PRICE} USDC on Base mainnet). ${FREE_TIER_HELP}`,
      }],
    };
  }
  try {
    const report = await auditSite(args.url.trim());
    await gate.claim();
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
      structuredContent: {
        payment_required: true,
        protocol: "x402-v2",
        method: "GET",
        url: endpoint,
        price_usdc: AGENT_READINESS_PRICE,
        network: "eip155:8453",
        settles: "only on a successful (2xx) response",
      },
    };
  } catch (error) {
    const code = error instanceof AuditError ? error.code : "AUDIT_FAILED";
    return { isError: true, content: [{ type: "text", text: `${code}: ${error.message}` }] };
  }
}

async function handlePOST(req) {
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
        serverInfo: { name: "santos-website-intelligence", version: "2.16.0" },
        instructions:
          `audit_website_preview is the ONE free tool: a real Quick Intelligence Audit, 1/day per caller IP, meant as a sample of the output rather than as capacity. Every other tool is paid via x402 v2 on Base mainnet and returns a canonical HTTP handoff rather than data — the MCP call validates the target and tells you exactly where to pay: audit_agent_readiness ($${AGENT_READINESS_PRICE} USDC), extract_page_markdown (/v1/extract, $${EXTRACT_PRICE}), extract_structured_data (POST /v1/extract/structured, $${STRUCTURED_EXTRACT_PRICE}), feed_parse (/v1/feed, $${FEED_PRICE}), link_map (/v1/links, $${LINKS_PRICE}), summarize (/v1/summarize, $${SUMMARIZE_PRICE}). No account or API key is required for any of them. Humans without a USDC wallet can buy a report by card at ${PUBLIC_API_BASE_URL}/agent-readiness/buy.`,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: [PREVIEW_TOOL, AGENT_READINESS_TOOL, EXTRACT_TOOL, STRUCTURED_EXTRACT_TOOL, FEED_PARSE_TOOL, LINK_MAP_TOOL, SUMMARIZE_TOOL] });
    case "tools/call": {
      if (params?.name === PREVIEW_TOOL.name) return rpcResult(id, await callAuditTool(params?.arguments, ipFromRequest(req)));
      if (params?.name === AGENT_READINESS_TOOL.name) return rpcResult(id, await callAgentReadinessTool(params?.arguments));
      if (params?.name === EXTRACT_TOOL.name) return rpcResult(id, callPaidHandoffTool(params?.arguments, { name: "Page-to-Markdown extraction", path: "/v1/extract", price: EXTRACT_PRICE }));
      if (params?.name === STRUCTURED_EXTRACT_TOOL.name) return rpcResult(id, callStructuredExtractHandoff(params?.arguments));
      if (params?.name === FEED_PARSE_TOOL.name) return rpcResult(id, callPaidHandoffTool(params?.arguments, { name: "Feed Parser", path: "/v1/feed", price: FEED_PRICE }));
      if (params?.name === LINK_MAP_TOOL.name) return rpcResult(id, callPaidHandoffTool(params?.arguments, { name: "Link Map", path: "/v1/links", price: LINKS_PRICE }));
      if (params?.name === SUMMARIZE_TOOL.name) return rpcResult(id, callPaidHandoffTool(params?.arguments, { name: "Summarizer", path: "/v1/summarize", price: SUMMARIZE_PRICE }));
      return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// A human clicking this link from the capabilities manifest gets a friendly
// explainer instead of a bare 405. MCP clients use POST (unchanged).
async function handleGET(req) {
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const explainer = {
    service: "Santos Website Intelligence — Model Context Protocol (MCP) endpoint",
    transport: "MCP over Streamable HTTP. Send JSON-RPC 2.0 requests via POST to this URL.",
    methods: ["initialize", "tools/list", "tools/call", "ping"],
    tools: ["audit_website_preview (free, 1/day per IP — the only free tool)", "audit_agent_readiness (paid via x402, returns the canonical HTTP handoff)", "extract_page_markdown (paid via x402, returns the canonical HTTP handoff for /v1/extract)", "extract_structured_data (paid via x402, returns the canonical HTTP handoff for POST /v1/extract/structured)", "feed_parse (paid via x402, returns the canonical HTTP handoff for /v1/feed)", "link_map (paid via x402, returns the canonical HTTP handoff for /v1/links)", "summarize (paid via x402, returns the canonical HTTP handoff for /v1/summarize)"],
    for_humans: `${PUBLIC_API_BASE_URL}/agent-readiness/buy — buy a human report by card ($9 Quick / $29 Deep), no account`,
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
<p>Tools: <code>audit_website_preview</code> (free, 1/day per IP — the only free tool), plus <code>audit_agent_readiness</code>, <code>extract_page_markdown</code>, <code>extract_structured_data</code>, <code>feed_parse</code>, <code>link_map</code>, and <code>summarize</code> (all paid via x402 handoffs).</p>
<p><strong>Just want a report?</strong> <a href="${PUBLIC_API_BASE_URL}/agent-readiness/buy" style="color:#d4a24e">Buy a human report by card — $9 Quick / $29 Deep →</a></p>
<p>Machine-readable: <a href="${PUBLIC_API_BASE_URL}/openapi.json" style="color:#d4a24e">OpenAPI</a> · <a href="${PUBLIC_API_BASE_URL}/llms.txt" style="color:#d4a24e">llms.txt</a> · <a href="${PUBLIC_API_BASE_URL}/capabilities.json" style="color:#d4a24e">capabilities.json</a></p>
</body>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600", Allow: "GET, POST" } });
  }
  return NextResponse.json(explainer, { status: 200, headers: { "Cache-Control": "public, max-age=3600", Allow: "GET, POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export const POST = withAgentLog(handlePOST, "mcp");
export const GET = withAgentLog(handleGET, "mcp-explainer");
