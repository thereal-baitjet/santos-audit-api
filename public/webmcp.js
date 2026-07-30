// WebMCP imperative tool registration (https://webmachinelearning.github.io/webmcp/).
// Registers the site's read-only capabilities as callable tools for agentic
// browsers. Declarative form annotations (toolname/tooldescription) live on the
// forms themselves; these names use snake_case so the two surfaces never collide.
(() => {
  const mc = navigator.modelContext ?? document.modelContext;
  if (!mc?.registerTool || !window.isSecureContext) return;

  const json = async (url, init) => {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...body };
  };

  const tools = [
    {
      name: "get_quick_audit_payment_terms",
      title: "Get Quick Intelligence Audit payment terms",
      description:
        "Fetch the live x402 payment terms (USDC amount on Base mainnet, pay-to address, canonical endpoint) for a Quick Intelligence Audit of the given URL. Costs 0.015 USDC per successful audit. Read-only: this makes the UNSIGNED request, so the service answers 402 with its terms and no audit runs and no payment is made until an x402 client signs and retries.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Public website URL to audit, e.g. https://example.com or example.com",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: ({ url }) => json(`/api/audit?url=${encodeURIComponent(url)}`),
    },
    {
      name: "get_agent_readiness_payment_terms",
      title: "Get Agent Readiness audit payment terms",
      description:
        "Fetch the live x402 payment terms (USDC amount on Base mainnet, pay-to address, canonical endpoint) for a paid Agent Readiness audit of the given URL. Read-only: no payment is made and no audit runs until an x402 client pays the returned terms.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Public website or service URL to get audit payment terms for",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: ({ url }) => json(`/agent-readiness/challenge?url=${encodeURIComponent(url)}`),
    },
    {
      name: "get_page_extraction_payment_terms",
      title: "Get page-to-Markdown extraction payment terms",
      description:
        "Fetch the live x402 payment terms for converting one public web page to clean Markdown with title, links, and metadata. Costs 0.005 USDC per successful extraction. Read-only: this makes the UNSIGNED request, so the service answers 402 with its terms and nothing is extracted or paid until an x402 client signs and retries.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Public web page URL to extract, e.g. https://example.com/article",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: ({ url }) => json(`/v1/extract?url=${encodeURIComponent(url)}`),
    },
    {
      name: "get_service_capabilities",
      title: "Get Santos service capability manifest",
      description:
        "Return the machine-readable capability manifest for Santos Website Intelligence: every audit tier, endpoint, price, payment protocol (x402 v2) and schema pointer.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => json("/.well-known/agent-capabilities.json"),
    },
  ];

  for (const tool of tools) {
    try {
      Promise.resolve(mc.registerTool(tool)).catch(() => {});
    } catch { /* older drafts throw synchronously on duplicate names */ }
  }
})();
