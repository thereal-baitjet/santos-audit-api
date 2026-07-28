import { PageShell } from "../components/SiteChrome.js";
import StructuredData from "../components/StructuredData.js";
import CopyButton from "../ci/CopyButton.js";
import { apiProduct } from "../../lib/products.js";

const API = "https://api.santosautomation.com";
const SITE = "https://www.santosautomation.com";
const MCP = `${API}/mcp`;
const REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers?search=com.santosautomation/site-audit";

const readiness = apiProduct("/api/agent-readiness").priceUsdc;
const feed = apiProduct("/v1/feed").priceUsdc;
const links = apiProduct("/v1/links").priceUsdc;
const summarize = apiProduct("/v1/summarize").priceUsdc;

export const metadata = {
  title: "MCP Server — Website Intelligence for Any MCP Client | Santos",
  description:
    "One Remote MCP endpoint, seven website-intelligence tools. Setup guides for Claude and Grok; free tools run inline, paid tools return an x402 handoff.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    title: "MCP Server — Website Intelligence for Any MCP Client | Santos",
    description:
      "One Remote MCP endpoint, seven website-intelligence tools. Setup guides for Claude and Grok.",
    url: `${SITE}/integrations`,
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebAPI",
      "@id": `${SITE}/integrations#api`,
      name: "Santos Website Intelligence — Remote MCP server",
      url: MCP,
      documentation: `${API}/openapi.json`,
      termsOfService: `${SITE}/terms`,
      provider: { "@id": `${SITE}/#organization` },
      serviceType: "Remote MCP server for AI website intelligence",
      description:
        "A Remote MCP server over Streamable HTTP exposing seven website-intelligence tools to any MCP-capable client. Free tools execute inline; paid tools return a canonical x402 request settled in USDC on Base.",
      offers: [
        { "@type": "Offer", name: "Agent Readiness audit (audit_agent_readiness)", price: readiness, priceCurrency: "USDC", url: `${API}/api/agent-readiness` },
        { "@type": "Offer", name: "Feed parse (feed_parse)", price: feed, priceCurrency: "USDC", url: `${API}/v1/feed` },
        { "@type": "Offer", name: "Link map (link_map)", price: links, priceCurrency: "USDC", url: `${API}/v1/links` },
        { "@type": "Offer", name: "Summarize (summarize)", price: summarize, priceCurrency: "USDC", url: `${API}/v1/summarize` },
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "MCP", item: `${SITE}/integrations` },
      ],
    },
  ],
};

const LIST_TOOLS = `curl -X POST ${MCP} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

export default function IntegrationsPage() {
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span><span>MCP</span>
        </div>

        <header className="page-hero">
          <p className="kicker">Remote MCP · Streamable HTTP · no account</p>
          <h1>One MCP endpoint, seven website-intelligence tools</h1>
          <p className="lede">
            Santos publishes a public Remote MCP server. Point any MCP-capable client at{" "}
            <code>{MCP}</code> and the tools appear — no account, no API key, no OAuth, no server
            to run. Free tools execute inline and need no wallet. Paid tools return a canonical
            x402 request that settles in USDC on Base, and only on success.
          </p>
          <p><CopyButton text={MCP} label="Copy endpoint" /></p>
          <div className="cta-row">
            <a className="btn" href="/integrations/claude">Claude setup</a>
            <a className="btn" href="/integrations/grok">Grok setup</a>
            <a className="btn" href={MCP}>Live endpoint</a>
          </div>
        </header>

        <section className="content-section">
          <p className="section-label">Setup</p>
          <h2>Pick your client</h2>
          <p className="sub wide">
            Same server, same registry listing, same tools — only the wiring differs. The one
            thing worth knowing before you start: <strong>Claude registers the server once, Grok
            names it per call.</strong>
          </p>
          <div className="integration-grid">
            <a href="/integrations/claude">
              <strong>Claude</strong>
              <span>Custom connector on Claude.ai, or <code>claude mcp add</code> for Claude Code — the two are configured separately</span>
            </a>
            <a href="/integrations/grok">
              <strong>Grok / xAI</strong>
              <span>Remote MCP tool named inline in each request&rsquo;s <code>tools</code> array — nothing to install</span>
            </a>
            <a href="/docs#grok">
              <strong>Any other MCP client</strong>
              <span>Streamable HTTP with strict input and output schemas — no client-specific server</span>
            </a>
          </div>
        </section>

        <section className="content-section">
          <p className="section-label">Reference</p>
          <h2>The seven tools</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Tool</th><th scope="col">Cost</th><th scope="col">Behavior</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row"><code>audit_website_preview</code></th><td>Free</td><td>Runs a Quick Intelligence Audit and returns the report inline</td></tr>
                <tr><th scope="row"><code>extract_page_markdown</code></th><td>Free</td><td>Returns one page as clean Markdown with title, links, and word count</td></tr>
                <tr><th scope="row"><code>extract_structured_data</code></th><td>Free</td><td>Returns JSON extracted against your own JSON Schema, re-validated before return</td></tr>
                <tr><th scope="row"><code>audit_agent_readiness</code></th><td>${readiness}</td><td>Returns the x402 handoff for the full Agent Readiness audit</td></tr>
                <tr><th scope="row"><code>feed_parse</code></th><td>${feed}</td><td>Returns the x402 handoff for RSS / Atom / JSON Feed normalization</td></tr>
                <tr><th scope="row"><code>link_map</code></th><td>${links}</td><td>Returns the x402 handoff for a categorized link map</td></tr>
                <tr><th scope="row"><code>summarize</code></th><td>${summarize}</td><td>Returns the x402 handoff for a structured page summary</td></tr>
              </tbody>
            </table>
          </div>
          <p className="sub wide">
            Every tool declares an input <em>and</em> output schema, so a client parses results
            structurally instead of scraping text. Verify the exact list yourself:
          </p>
          <pre className="code-sample" tabIndex={0}><code>{LIST_TOOLS}</code></pre>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>Free tools run inline</h2>
            <p>
              The three preview tools execute end to end and return the result. One call per day
              per identity — the calling IP unless you pass a{" "}
              <a href="/free-token">free verified-email token</a>, which matters because hosted
              agents share one egress address between all their users.
            </p>
          </div>
          <div>
            <h2>Paid tools hand back a request</h2>
            <p>
              A paid tool charges nothing and never asks for credentials. It validates the target
              and returns a typed handoff — price, network, and the exact URL to pay for.{" "}
              <strong>No model signs x402 payments or holds a wallet.</strong> Completing one
              takes a wallet-enabled wrapper. Worked example on the{" "}
              <a href="/integrations/grok">Grok page</a>.
            </p>
          </div>
        </section>

        <section className="content-section">
          <p className="section-label">Verification</p>
          <h2>One server, one listing</h2>
          <p className="sub wide">
            There is no client-specific server and no duplicate registry entry. The listing is
            published in the official MCP Registry as <code>com.santosautomation/site-audit</code>,
            and its <code>streamable-http</code> remote is exactly the endpoint above.
          </p>
          <div className="integration-grid">
            <a href={REGISTRY}><strong>Official MCP Registry</strong><span>com.santosautomation/site-audit — verify the remote URL</span></a>
            <a href="/openapi.json" data-analytics-event="openapi_downloaded"><strong>OpenAPI 3.1</strong><span>Typed operations, schemas, errors, and x402 behavior</span></a>
            <a href="/.well-known/agent-capabilities.json"><strong>Capability manifest</strong><span>Selection guidance, pricing, limits, and support</span></a>
            <a href="/llms.txt"><strong>llms.txt</strong><span>Low-noise service guide and canonical machine links</span></a>
            <a href="/version"><strong>/version</strong><span>Current API version and contract URLs</span></a>
            <a href="/status"><strong>/status</strong><span>Live availability of every capability</span></a>
          </div>
          <p className="sub wide">
            Problems connecting: <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.
          </p>
        </section>

        <section className="content-section related">
          <h2>Continue</h2>
          <div className="related-links">
            <a href="/docs">API documentation<span aria-hidden="true"> →</span></a>
            <a href="/free-token">Get a free-tier token<span aria-hidden="true"> →</span></a>
            <a href="/ci">Gate pull requests on agent readiness<span aria-hidden="true"> →</span></a>
            <a href="/methodology/agent-readiness">Scoring methodology<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
