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
      name: "run_quick_audit",
      title: "Run free Quick Intelligence Audit",
      description:
        "Run a free website intelligence audit of a public URL (1 per day per IP). Returns the AI Website Intelligence score, per-dimension scores (performance, technical SEO, accessibility, security) and prioritized issues. For unlimited machine access use GET https://api.santosautomation.com/api/audit (x402, 0.005 USDC).",
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
      execute: ({ url }) => json(`/api/audit/demo?url=${encodeURIComponent(url)}`),
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
