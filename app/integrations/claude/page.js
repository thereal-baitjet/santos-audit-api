import { PageShell } from "../../components/SiteChrome.js";
import StructuredData from "../../components/StructuredData.js";
import CopyButton from "../../ci/CopyButton.js";
import { apiProduct } from "../../../lib/products.js";

const API = "https://api.santosautomation.com";
const SITE = "https://www.santosautomation.com";
const MCP = `${API}/mcp`;
const REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers?search=com.santosautomation/site-audit";

// Prices resolve from the canonical catalog so this page can never advertise a
// number the paywall does not charge (tests/catalog-consistency.test.js).
const readiness = apiProduct("/api/agent-readiness").priceUsdc;
const feed = apiProduct("/v1/feed").priceUsdc;
const links = apiProduct("/v1/links").priceUsdc;
const summarize = apiProduct("/v1/summarize").priceUsdc;

export const metadata = {
  title: "Claude Integration — Remote MCP Website Intelligence | Santos",
  description:
    "Add Santos to Claude as a custom connector. The same production MCP server Grok uses: free tools run directly, paid tools return an x402 handoff.",
  alternates: { canonical: "/integrations/claude" },
  openGraph: {
    title: "Claude Integration — Remote MCP Website Intelligence | Santos",
    description:
      "Add Santos to Claude as a custom connector. The same production MCP server Grok uses: free tools run directly, paid tools return an x402 handoff.",
    url: `${SITE}/integrations/claude`,
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebAPI",
      "@id": `${SITE}/integrations/claude#api`,
      name: "Santos Website Intelligence — Remote MCP server",
      url: MCP,
      documentation: `${API}/openapi.json`,
      termsOfService: `${SITE}/terms`,
      provider: { "@id": `${SITE}/#organization` },
      serviceType: "Remote MCP server for AI website intelligence",
      description:
        "A Remote MCP server over Streamable HTTP exposing seven website-intelligence tools to Claude and any MCP-capable client. Free tools execute inline; paid tools return a canonical x402 request settled in USDC on Base by a wallet-enabled wrapper.",
      offers: [
        { "@type": "Offer", name: "Agent Readiness audit (audit_agent_readiness)", price: readiness, priceCurrency: "USDC", url: `${API}/api/agent-readiness` },
        { "@type": "Offer", name: "Feed parse (feed_parse)", price: feed, priceCurrency: "USDC", url: `${API}/v1/feed` },
        { "@type": "Offer", name: "Link map (link_map)", price: links, priceCurrency: "USDC", url: `${API}/v1/links` },
        { "@type": "Offer", name: "Summarize (summarize)", price: summarize, priceCurrency: "USDC", url: `${API}/v1/summarize` },
      ],
    },
    {
      "@type": "TechArticle",
      "@id": `${SITE}/integrations/claude#guide`,
      headline: "Claude-ready website intelligence through one Remote MCP endpoint",
      url: `${SITE}/integrations/claude`,
      description:
        "Add the Santos MCP server to Claude as a custom connector, then use free tools directly or settle paid tools over x402.",
      about: { "@id": `${SITE}/integrations/claude#api` },
      provider: { "@id": `${SITE}/#organization` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Integrations", item: `${SITE}/integrations/claude` },
        { "@type": "ListItem", position: 3, name: "Claude", item: `${SITE}/integrations/claude` },
      ],
    },
  ],
};

const SAMPLE_PROMPT =
  "Use the Santos tools to audit https://www.santosautomation.com/integrations/grok. " +
  "Return the Website Intelligence score, the four dimension scores, and the three highest-impact fixes.";

const LIST_TOOLS = `curl -X POST ${MCP} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

// -s user, not the default local scope: local registers the server for one
// directory only, so it silently disappears when you open another project.
const CLAUDE_CODE = `claude mcp add -s user --transport http santos ${MCP}

# confirm it registered
claude mcp list
# santos: ${MCP} (HTTP) - ✔ Connected`;

export default function ClaudeIntegrationPage() {
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span>
          <span>Integrations</span><span aria-hidden="true">/</span>
          <span>Claude</span>
        </div>

        <header className="page-hero">
          <p className="kicker">Integration · Remote MCP · Claude</p>
          <h1>Claude-ready website intelligence through one Remote MCP endpoint</h1>
          <p className="lede">
            Add <code>{MCP}</code> to Claude as a custom connector and seven website-intelligence
            tools appear. This is the <strong>same production MCP server the Grok integration
            uses</strong> — one endpoint, one registry listing, different client setup. No account,
            no API key, no server to run.
          </p>
          <div className="cta-row">
            <a className="btn" href={MCP}>Live MCP endpoint</a>
            <a className="btn" href="/integrations/grok">Grok setup</a>
            <a className="btn" href="/docs">API docs</a>
          </div>
        </header>

        <section className="content-section">
          <p className="section-label">Step one</p>
          <h2>Add the connector</h2>
          <p className="sub wide">
            <strong>Claude.ai and Claude Code are configured separately.</strong> A connector added
            in Claude.ai settings is not visible to Claude Code, and vice versa — adding it in one
            place and calling it from the other is the most common reason the tools appear missing.
            Pick the surface you actually use.
          </p>
          <h3>Claude.ai</h3>
          <p className="sub wide">
            Open <strong>Settings</strong> → <strong>Connectors</strong> →{" "}
            <strong>Add custom connector</strong>, paste the endpoint below, and connect. Claude
            handles discovery from there — it calls <code>tools/list</code>, reads the input
            schemas, and decides when to invoke. Custom connectors require a paid Claude plan. If
            the server does not appear in your connector list afterwards, it did not save; add it
            again.
          </p>
          <p><CopyButton text={MCP} label="Copy endpoint" /></p>
          <pre className="code-sample" tabIndex={0}><code>{MCP}</code></pre>
          <h3>Claude Code</h3>
          <p className="sub wide">
            Register it from the CLI. Use <code>-s user</code> — the default <code>local</code>{" "}
            scope registers the server for the current directory only, so it vanishes the moment
            you open another project.
          </p>
          <p><CopyButton text={CLAUDE_CODE} label="Copy command" /></p>
          <pre className="code-sample" tabIndex={0}><code>{CLAUDE_CODE}</code></pre>
          <p className="sub wide">
            Restart the session afterwards — MCP servers are read at startup, so the tools are not
            callable until Claude Code reloads. If <code>claude mcp list</code> shows entries
            prefixed <code>claude.ai</code>, those are your Claude.ai connectors mirrored into the
            CLI; a Santos entry missing from that list means the Claude.ai connector was never
            saved.
          </p>
          <h3>Either way</h3>
          <p className="sub wide">
            Nothing else to configure. The endpoint is public and unauthenticated — there is no
            OAuth step, no token to paste, and no key to manage. If a client prompts for OAuth it
            is guessing; Santos requires none. Verify the exact tool list Claude will see from your
            own shell:
          </p>
          <pre className="code-sample" tabIndex={0}><code>{LIST_TOOLS}</code></pre>
        </section>

        <section className="content-section">
          <p className="section-label">Step two</p>
          <h2>Ask Claude to use it</h2>
          <p className="sub wide">
            Paste this once the connector is attached. It audits a real page, so you can check the
            answer against what the page actually says.
          </p>
          <p><CopyButton text={SAMPLE_PROMPT} label="Copy prompt" /></p>
          <pre className="code-sample" tabIndex={0}><code>{SAMPLE_PROMPT}</code></pre>
          <p className="sub wide">
            Claude picks <code>audit_website_preview</code> — a free tool, so no wallet is
            involved — and returns the Website Intelligence score, the four dimension scores, and
            prioritized fixes. If that comes back, the connector is working.
          </p>
        </section>

        <section className="content-section">
          <p className="section-label">Reference</p>
          <h2>What Claude sees</h2>
          <p className="sub wide">
            Seven tools. Three run directly and return a result inline. Four validate the target
            and hand back a payment request — see the next section for what that means.
          </p>
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
            Free tools share one quota: one call per day per identity. Without a token that
            identity is the calling IP; pass the optional <code>token</code> argument (a
            verified-email token from <code>/api/leads/verify/*</code>) and the quota moves onto
            that user instead.
          </p>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>Free tools run directly</h2>
            <p>
              The three preview tools execute end to end inside the connector call and return the
              result to Claude. No wallet, no payment, no configuration beyond attaching the
              endpoint. This is the whole experience for evaluation and for most conversational
              use.
            </p>
          </div>
          <div>
            <h2>Paid tools hand back a request</h2>
            <p>
              A paid tool does not charge anything and does not ask Claude for credentials. It
              validates the target and returns a canonical x402 HTTP request — the price, the
              network, and the exact URL to pay for. <strong>Claude does not sign x402 payments
              and does not manage a wallet.</strong> Completing one requires a wallet-enabled
              application or an agent wrapper holding its own key. See the{" "}
              <a href="/integrations/grok">handoff pattern</a> for a worked example.
            </p>
          </div>
        </section>

        <section className="content-section">
          <p className="section-label">Verification</p>
          <h2>One server, one listing</h2>
          <p className="sub wide">
            Claude and Grok connect to the same endpoint. There is no Claude-specific server, no
            duplicate registry entry, and no separate tool set — only a different client setup.
            The listing is published in the official MCP Registry under{" "}
            <code>com.santosautomation/site-audit</code> and its <code>streamable-http</code>{" "}
            remote is exactly the endpoint above.
          </p>
          <div className="integration-grid">
            <a href={REGISTRY}><strong>Official MCP Registry</strong><span>com.santosautomation/site-audit — verify the remote URL</span></a>
            <a href={MCP}><strong>MCP endpoint</strong><span>Streamable HTTP · seven tools · strict schemas</span></a>
            <a href="/openapi.json" data-analytics-event="openapi_downloaded"><strong>OpenAPI 3.1</strong><span>Typed operations, schemas, errors, and x402 behavior</span></a>
            <a href="/.well-known/agent-capabilities.json"><strong>Capability manifest</strong><span>Selection guidance, pricing, limits, and support</span></a>
            <a href="/llms.txt"><strong>llms.txt</strong><span>Low-noise service guide and canonical machine links</span></a>
            <a href="/status"><strong>Status</strong><span>Live availability of every capability</span></a>
          </div>
          <p className="sub wide">
            Questions or a problem connecting:{" "}
            <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.
          </p>
        </section>

        <section className="content-section related">
          <h2>Continue</h2>
          <div className="related-links">
            <a href="/integrations/grok">Grok &amp; xAI — same endpoint, different setup<span aria-hidden="true"> →</span></a>
            <a href="/docs">API documentation<span aria-hidden="true"> →</span></a>
            <a href="/methodology/agent-readiness">Scoring methodology<span aria-hidden="true"> →</span></a>
            <a href="/changelog">Changelog<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
