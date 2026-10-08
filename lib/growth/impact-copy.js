// Business-impact phrasing for CHECK_REGISTRY ids. Each entry ties an
// engineering failure to a consequence (traffic, revenue, AI-engine
// exclusion) and stays strictly to what the check actually measured; we do
// not invent statistics, so no copy here quotes percentages or dollar loss.
//
//   label  bold lead-in used in the executive summary
//   impact one-to-two sentence consequence
//   why    single public sentence for the viral teaser (no jargon wall)

/** @type {Record<string, { label: string, impact: string, why: string }>} */
export const IMPACT_COPY = Object.freeze({
  "agent.llms_txt.present": {
    label: "AI Blindspot: no llms.txt",
    impact: "Autonomous discovery engines (Perplexity, OpenAI SearchGPT) get no curated map of your site, so they guess from raw HTML or skip you. That is Machine Invisibility: competitors who publish one get cited and you do not.",
    why: "No llms.txt, so AI answer engines have no map of the site and are left guessing what it even sells.",
  },
  "agent.llms_txt.format": {
    label: "Malformed llms.txt",
    impact: "The file exists but does not follow the llmstxt.org structure, so parsers can't reliably extract your sections. You paid the cost of publishing it without getting the discovery benefit.",
    why: "Their llms.txt exists but is malformed, so AI parsers can't reliably read it.",
  },
  "agent.llms_txt.quality": {
    label: "Thin llms.txt",
    impact: "Agents find the file but learn little about capabilities, pricing, or limits. Thin context means AI recommendations default to better-described competitors.",
    why: "Their llms.txt says too little for an AI agent to recommend them with confidence.",
  },
  "agent.crawlability": {
    label: "Machine interfaces blocked in robots.txt",
    impact: "robots.txt closes the very files agents need (llms.txt, OpenAPI, MCP, /api). Every compliant AI crawler is turned away at the door.",
    why: "robots.txt blocks the exact machine files AI agents need, so compliant crawlers turn away.",
  },
  "agent.discovery.links": {
    label: "Machine interfaces not advertised",
    impact: "Nothing in the HTML or HTTP headers points agents to your machine-readable surfaces. If an agent can't find the interface, the interface doesn't exist to it.",
    why: "Nothing on the homepage points AI agents to a machine-readable interface.",
  },
  "agent.docs.machine_readable": {
    label: "Documentation agents can't read",
    impact: "Public docs are missing or buried in client-side rendering, so agents can't learn how to use you. Unread docs mean zero AI-driven adoption.",
    why: "Their docs are unreadable to AI agents without a full browser.",
  },
  "agent.jsonld.parseable": {
    label: "Broken structured data",
    impact: "JSON-LD on the page fails to parse, so search and AI engines discard it. Rich results and entity understanding are forfeited.",
    why: "Their structured data is broken JSON, so AI engines throw it away.",
  },
  "agent.jsonld.identity": {
    label: "No machine-readable identity",
    impact: "There's no Organization, WebSite, or Service markup telling engines who you are. AI answers can confuse your brand with others or leave it out entirely.",
    why: "No machine-readable identity markup, so AI engines can't be sure who the brand even is.",
  },
  "agent.jsonld.webapi": {
    label: "API not described as a service",
    impact: "Your API exists but isn't described with WebAPI metadata. Procurement agents comparing vendors can't classify it, so it drops off shortlists.",
    why: "Their API isn't described in structured data, so AI procurement agents can't classify it.",
  },
  "agent.metadata.consistency": {
    label: "Contradictory public metadata",
    impact: "Names, URLs, or prices disagree across public surfaces. Agents treat contradictions as risk and choose a vendor whose facts line up.",
    why: "Their public metadata contradicts itself, and AI agents treat contradictions as risk.",
  },
  "agent.openapi.discovery": {
    label: "Operational friction: no discoverable OpenAPI",
    impact: "Agents can't find a typed contract for your API, so every integration is hand-built. That is a High Integration Tax for AI procurement agents, and they route to vendors who don't charge it.",
    why: "No discoverable OpenAPI spec, so AI agents can't call them without a human writing glue code.",
  },
  "agent.openapi.valid": {
    label: "Invalid OpenAPI document",
    impact: "The spec doesn't parse as OpenAPI 3.x or Swagger 2.0, so code generators and agents reject it. A broken contract is worse than none because it fails at the moment of purchase.",
    why: "Their OpenAPI spec doesn't even parse, so agent tooling rejects it outright.",
  },
  "agent.openapi.operations": {
    label: "Unlabelled API operations",
    impact: "Operations lack stable operationIds and summaries, so an LLM can't tell which call does what. Agents pick the wrong tool or give up.",
    why: "Their API operations are unlabelled, so an AI agent can't tell which call does what.",
  },
  "agent.openapi.schemas": {
    label: "Untyped API inputs and outputs",
    impact: "Requests and responses aren't typed, so agents send malformed calls and can't parse results. Every failed call is a failed transaction.",
    why: "Their API inputs and outputs aren't typed, so AI agents' calls fail.",
  },
  "agent.openapi.auth_payment": {
    label: "Undocumented auth or payment",
    impact: "The spec doesn't say how to authenticate or pay. An agent that can't figure out how to pay can't buy.",
    why: "Their API never says how to authenticate or pay, so autonomous buyers can't check out.",
  },
  "agent.capabilities.manifest": {
    label: "Incomplete capability manifest",
    impact: "The advertised manifest is missing inputs, costs, or limits. Agents can't compare you against alternatives, so you lose the comparison by default.",
    why: "Their capability manifest is incomplete, so AI agents can't compare them to alternatives.",
  },
  "agent.mcp.advertised": {
    label: "Operational friction: MCP not advertised",
    impact: "Assistants like Claude and ChatGPT connect to tools via Model Context Protocol, and yours isn't advertised. Agents that could have acted on your behalf never learn they can.",
    why: "No advertised MCP server, so AI assistants like Claude and ChatGPT can't act on the site.",
  },
  "agent.mcp.registry": {
    label: "Missing from the MCP Registry",
    impact: "The server isn't listed in the official MCP Registry where agents and developers search for tools. Unlisted means undiscovered.",
    why: "Their MCP server isn't in the official registry, so agents searching for tools never find it.",
  },
  "agent.mcp.transport": {
    label: "MCP endpoint doesn't negotiate",
    impact: "The MCP endpoint doesn't speak a current, standards-compatible transport. Clients connect, fail, and move on.",
    why: "Their MCP endpoint fails the protocol handshake, so AI clients connect and bail.",
  },
  "agent.mcp.tools": {
    label: "No usable MCP tools",
    impact: "The server exposes no tools with strict schemas, so agents have nothing to invoke. A connection with no tools is a dead end.",
    why: "Their MCP server exposes no usable tools, so there's nothing for an AI agent to do.",
  },
  "agent.mcp.structured_output": {
    label: "Unstructured MCP output",
    impact: "Tools return free text with no outputSchema, so agents must guess at results. Guessing leads to errors, and errors get you dropped from agent workflows.",
    why: "Their MCP tools return unstructured text, so agents have to guess at the results.",
  },
  "agent.commerce.challenge": {
    label: "No machine-payable checkout",
    impact: "Paid resources don't return a valid payment challenge, so agents with wallets can't transact. Autonomous buyers drop off at the exact moment they would pay.",
    why: "Their paid endpoints return no valid payment challenge, so autonomous buyers drop off at checkout.",
  },
  "agent.commerce.discovery": {
    label: "Pricing not machine-readable",
    impact: "Price, unit, and network aren't published in a form agents can read. An agent that can't quote you can't choose you.",
    why: "Their pricing isn't machine-readable, so AI agents can't quote them.",
  },
  "agent.trust.https": {
    label: "Interfaces served without HTTPS",
    impact: "Machine interfaces are reachable over plain HTTP. Security-conscious agents and enterprise buyers refuse insecure endpoints.",
    why: "Some of their machine interfaces skip HTTPS, and careful agents refuse insecure endpoints.",
  },
  "agent.trust.contact": {
    label: "No visible provider or support info",
    impact: "Agents can't find who runs the service or where to escalate. Unaccountable vendors get filtered out of procurement shortlists.",
    why: "No visible support or status info, so AI procurement agents can't vet them.",
  },
  "agent.trust.terms_privacy": {
    label: "Terms and privacy hard to find",
    impact: "Agents can't verify terms, privacy, or data retention. Compliance-gated buyers stop there.",
    why: "Their terms and privacy policies are hard for AI agents to find, which stops compliance-gated buyers.",
  },
  "agent.trust.errors_limits": {
    label: "Undocumented errors and rate limits",
    impact: "Agents don't know your retry rules or quotas, so they hammer, fail, and churn. Integration reliability is a buying criterion for automated buyers.",
    why: "Their errors and rate limits are undocumented, so AI integrations break in production.",
  },
});

/** Copy for a finding, falling back to the finding's own title/recommendation. */
export function copyFor(finding) {
  return IMPACT_COPY[finding.id] ?? {
    label: finding.title,
    impact: finding.recommendation,
    why: `${finding.title}.`,
  };
}
