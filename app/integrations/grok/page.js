import { PageShell } from "../../components/SiteChrome.js";
import StructuredData from "../../components/StructuredData.js";
import CopyButton from "../../ci/CopyButton.js";
import { apiProduct } from "../../../lib/products.js";

const API = "https://api.santosautomation.com";
const SITE = "https://www.santosautomation.com";

// Prices resolve from the canonical catalog so this page can never advertise a
// number the paywall does not charge (tests/catalog-consistency.test.js).
const readiness = apiProduct("/api/agent-readiness").priceUsdc;
const feed = apiProduct("/v1/feed").priceUsdc;
const links = apiProduct("/v1/links").priceUsdc;
const summarize = apiProduct("/v1/summarize").priceUsdc;

export const metadata = {
  // Kept inside the 50–160 character band the Quick Audit checks for.
  title: "Grok & xAI Integration — Remote MCP Website Intelligence | Santos",
  description:
    "Add the Santos MCP server to Grok in one line. Seven website-intelligence tools: a free preview needs no wallet, the rest settle over x402.",
  alternates: { canonical: "/integrations/grok" },
};

// The page advertises paid access, so it carries the machine-readable Offer and
// WebAPI metadata an agent needs to price the service without reading prose.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebAPI",
      "@id": `${SITE}/integrations/grok#api`,
      name: "Santos Website Intelligence — Remote MCP server",
      url: `${API}/mcp`,
      documentation: `${API}/openapi.json`,
      termsOfService: `${SITE}/terms`,
      provider: { "@id": `${SITE}/#organization` },
      serviceType: "Remote MCP server for AI website intelligence",
      description:
        "A Remote MCP server over Streamable HTTP exposing seven website-intelligence tools to Grok and any MCP-capable client. One free preview executes inline; paid tools return a canonical x402 request settled in USDC on Base.",
      offers: [
        { "@type": "Offer", name: "Agent Readiness audit (audit_agent_readiness)", price: readiness, priceCurrency: "USDC", url: `${API}/api/agent-readiness` },
        { "@type": "Offer", name: "Feed parse (feed_parse)", price: feed, priceCurrency: "USDC", url: `${API}/v1/feed` },
        { "@type": "Offer", name: "Link map (link_map)", price: links, priceCurrency: "USDC", url: `${API}/v1/links` },
        { "@type": "Offer", name: "Summarize (summarize)", price: summarize, priceCurrency: "USDC", url: `${API}/v1/summarize` },
      ],
    },
    {
      "@type": "TechArticle",
      "@id": `${SITE}/integrations/grok#guide`,
      headline: "Grok-ready website intelligence in one line",
      url: `${SITE}/integrations/grok`,
      description:
        "Register the Santos MCP server as a Grok Remote MCP tool, then use the free preview or settle paid tools over x402.",
      about: { "@id": `${SITE}/integrations/grok#api` },
      provider: { "@id": `${SITE}/#organization` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Integrations", item: `${SITE}/integrations/grok` },
        { "@type": "ListItem", position: 3, name: "Grok", item: `${SITE}/integrations/grok` },
      ],
    },
  ],
};

const MCP_SNIPPET = `from xai_sdk.tools import mcp

tools = [
    mcp(
        server_url="${API}/mcp",
        server_label="santos",
    )
]`;

const SAMPLE_PROMPT =
  "audit https://www.santosautomation.com/integrations/grok with the Santos tools.";

const LIST_TOOLS = `curl -X POST ${API}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

// Verbatim from a live tools/call. The handoff arrives as isError: true with a
// single text block — payment-required is signalled on MCP's error channel, so
// the model treats it as "not done yet" rather than a finished answer.
const HANDOFF = `{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "PAYMENT_REQUIRED: Agent Readiness costs $${readiness} USDC per successful
               audit on Base mainnet via x402 v2. Request
               ${API}/api/agent-readiness?url=https%3A%2F%2Fexample.com%2F&depth=quick
               without a signature to receive PAYMENT-REQUIRED terms, then sign and
               retry with PAYMENT-SIGNATURE."
    }
  ]
}`;

const SETTLE = `// Any x402 v2 client settles the URL named in the handoff text.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{
    network: "eip155:8453",
    client: new ExactEvmScheme(privateKeyToAccount(process.env.X402_PRIVATE_KEY)),
  }],
});

// Build the same URL the handoff names — the 402, signing, and retry are automatic.
const target = "https://example.com";
const res = await fetchWithPay(
  \`${API}/api/agent-readiness?url=\${encodeURIComponent(target)}&depth=quick\`
);
const report = await res.json();
console.log(report.website_intelligence_score);`;

export default function GrokIntegrationPage() {
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span>
          <span>Integrations</span><span aria-hidden="true">/</span>
          <span>Grok</span>
        </div>

        <header className="page-hero">
          <p className="kicker">Integration · Remote MCP · xAI</p>
          <h1>Grok-ready website intelligence in one line</h1>
          <p className="lede">
            Grok supports Remote MCP tools. Santos publishes a public MCP server over Streamable
            HTTP. Point Grok at it and seven website-intelligence tools appear in the model&rsquo;s
            tool list — no account, no API key, no server to run. The free preview needs no wallet.
            Paid tools return a canonical x402 request that settles in USDC on Base, and only on
            success.
          </p>
          <div className="cta-row">
            <a className="btn" href={`${API}/mcp`}>Live MCP endpoint</a>
            <a className="btn" href="/docs">API docs</a>
            <a className="btn" href="/openapi.json" data-analytics-event="openapi_downloaded">OpenAPI</a>
          </div>
        </header>

        <section className="content-section">
          <p className="section-label">Step one</p>
          <h2>Add the server</h2>
          <p className="sub wide">
            Register the endpoint as a Remote MCP tool in the xAI SDK. Grok performs discovery
            itself — it calls <code>tools/list</code>, reads the strict input schemas, and decides
            when to invoke. Nothing else is required to get the tools in front of the model.
          </p>
          <p><CopyButton text={MCP_SNIPPET} label="Copy snippet" /></p>
          <pre className="code-sample" tabIndex={0}><code>{MCP_SNIPPET}</code></pre>
          <p className="sub wide">
            The <code>server_label</code> is how the tools are namespaced in the model&rsquo;s
            context; <code>santos</code> keeps traces readable. Note the endpoint travels{" "}
            <strong>inline in each request</strong> — there is no connector to install and nothing
            persisted on an account, which is the main way this differs from{" "}
            <a href="/integrations/claude">the Claude setup</a>, where the server is registered
            once and then available to every conversation. Verify the same list the model sees,
            from your own shell:
          </p>
          <pre className="code-sample" tabIndex={0}><code>{LIST_TOOLS}</code></pre>
        </section>

        <section className="content-section">
          <p className="section-label">Step two</p>
          <h2>Ask Grok to use it</h2>
          <p className="sub wide">
            Nothing else to configure. Paste this into Grok with the server registered — it audits
            this very page, so you can check the answer against what is in front of you.
          </p>
          <p><CopyButton text={SAMPLE_PROMPT} label="Copy prompt" /></p>
          <pre className="code-sample" tabIndex={0}><code>{SAMPLE_PROMPT}</code></pre>
          <p className="sub wide">
            Grok picks <code>audit_website_preview</code> on its own — a free tool, so no wallet is
            involved — and returns scores across the four dimensions, the individual pass/fail
            checks, and prioritized fixes. If that comes back, your wiring is correct and
            everything else on this page is a variation on it.
          </p>
        </section>

        <section className="content-section">
          <p className="section-label">Step three</p>
          <h2>What Grok sees</h2>
          <p className="sub wide">
            Seven tools. One free preview executes and returns a full result inline. The other
            six validate the target and return the canonical x402 HTTP request — they never move
            funds themselves.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Cost</th>
                  <th scope="col">Behavior</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row"><code>audit_website_preview</code></th><td>Free</td><td>Runs a Quick Intelligence Audit and returns the report inline — 1/day per calling IP</td></tr>
                <tr><th scope="row"><code>extract_page_markdown</code></th><td>Paid</td><td>Returns the x402 handoff for /v1/extract — one page as clean Markdown with title, links, and word count</td></tr>
                <tr><th scope="row"><code>extract_structured_data</code></th><td>Paid</td><td>Returns the x402 handoff for POST /v1/extract/structured — JSON extracted against your own JSON Schema, re-validated before return</td></tr>
                <tr><th scope="row"><code>audit_agent_readiness</code></th><td>${readiness}</td><td>Returns the x402 handoff for the full Agent Readiness audit</td></tr>
                <tr><th scope="row"><code>feed_parse</code></th><td>${feed}</td><td>Returns the x402 handoff for RSS / Atom / JSON Feed normalization</td></tr>
                <tr><th scope="row"><code>link_map</code></th><td>${links}</td><td>Returns the x402 handoff for a categorized link map</td></tr>
                <tr><th scope="row"><code>summarize</code></th><td>${summarize}</td><td>Returns the x402 handoff for a structured page summary</td></tr>
              </tbody>
            </table>
          </div>
          <p className="sub wide">
            All prices are USDC on Base mainnet (<code>eip155:8453</code>). The free preview is
            <strong> one call per day per calling IP</strong>.
          </p>
          <p className="sub wide">
            That matters when Grok is the caller: a hosted agent reaches this server from xAI
            infrastructure, so that single daily call is shared by every Grok user at once. Treat
            the preview as a sample of the output, not as capacity — for anything beyond
            evaluation, pay per call. There is no quota on the paid endpoints.
          </p>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>Try it without a wallet</h2>
            <p>
              Ask Grok to audit a URL and it will reach for{" "}
              <code>audit_website_preview</code> on its own. That call executes end to end and
              returns scores, pass/fail checks, and remediation guidance inline — no payment, no
              wallet, no configuration beyond the one line above — one audit per day per calling
              IP. This is the fastest way to confirm the wiring works before a key is ever
              involved.
            </p>
          </div>
          <div>
            <h2>Then pay per call</h2>
            <p>
              Paid tools need a funded EVM wallet holding USDC on Base mainnet. Fund a dedicated
              key with only what you expect to spend — never a treasury or personal key. There is
              still no account and no API key: authorization is the signed payment itself, carried
              in the HTTP request. A failed call is never charged.
            </p>
          </div>
        </section>

        <section className="content-section">
          <p className="section-label">Step four</p>
          <h2>The handoff pattern</h2>
          <p className="sub wide">
            This is the part worth understanding. A paid MCP tool does not settle payment. It
            validates the target, then returns the exact HTTP request to pay for — method, URL,
            price, network, and protocol. Your agent, or a thin wrapper around it, performs the
            settlement. Santos never holds a key of yours and never signs on your behalf.
          </p>
          <div className="flow">
            <span className="c"># tools/call audit_agent_readiness — returns terms, moves no funds</span><br />
            Grok → santos.audit_agent_readiness(url)<br />
            <span className="a">← canonical x402 request + price + network</span><br />
            → your wrapper retries that URL with a PAYMENT-SIGNATURE header<br />
            <span className="g">← 200 · versioned evidence + PAYMENT-RESPONSE receipt</span>
          </div>
          <p className="sub wide">
            The tool result comes back on MCP&rsquo;s error channel — <code>isError: true</code>{" "}
            with one text block. That is deliberate: a payment-required result is not a finished
            answer, and signalling it as an error keeps the model from reporting a price quote as
            though it were an audit. The text names the price and the exact URL to pay for:
          </p>
          <pre className="code-sample" tabIndex={0}><code>{HANDOFF}</code></pre>
          <p className="sub wide">
            Settling it is a single wrapped <code>fetch</code> against that URL. Any x402 v2 client
            works; the payment step is identical to the one in the <a href="/ci">CI recipe</a>.
          </p>
          <p><CopyButton text={SETTLE} label="Copy settlement" /></p>
          <pre className="code-sample" tabIndex={0}><code>{SETTLE}</code></pre>
        </section>

        <section className="content-section">
          <p className="section-label">Rationale</p>
          <h2>Why this works</h2>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>MCP does the discovery</h3>
              <p>
                Tools carry strict JSON Schemas for both input and output, so Grok selects and
                calls them without glue code or prompt scaffolding. Registered in the official MCP
                Registry as <code>com.santosautomation/site-audit</code>.
              </p>
            </article>
            <article className="feature-card">
              <h3>x402 removes onboarding</h3>
              <p>
                Payment travels inside the HTTP request. No signup, no key rotation, no invoice, no
                per-seat plan — an autonomous agent can transact without a human provisioning
                anything first.
              </p>
            </article>
            <article className="feature-card">
              <h3>Settlement only on success</h3>
              <p>
                Funds move only on a 2xx response. A timeout, an unreachable target, or a target
                that fails validation costs nothing, so a retrying agent cannot burn money on
                failures.
              </p>
            </article>
            <article className="feature-card">
              <h3>Applicability-aware scoring</h3>
              <p>
                An informational site is not penalized for lacking an API, MCP, or machine
                commerce. Checks that do not apply are marked non-applicable rather than failed,
                and every report states its own evidence coverage.
              </p>
            </article>
            <article className="feature-card">
              <h3>Verifiable output</h3>
              <p>
                Every report is HMAC-SHA256 signed and independently checkable at{" "}
                <a href="/verify">/verify</a>. An agent can prove a score came from Santos and was
                not altered in transit.
              </p>
            </article>
            <article className="feature-card">
              <h3>We hold ourselves to it</h3>
              <p>
                Santos scores <strong>100/100</strong> on its own Agent Readiness audit — first of{" "}
                <a href="/reports">311 public reports</a>, against an index average of 59.6. The
                report is public, signed, and re-runnable.
              </p>
            </article>
          </div>
        </section>

        <section className="content-section">
          <p className="section-label">Contracts</p>
          <h2>Machine surfaces</h2>
          <p className="sub wide">
            Everything Grok needs to reason about this service is public and versioned. Current
            release and live status are always machine-readable.
          </p>
          <div className="integration-grid">
            <a href="https://registry.modelcontextprotocol.io/v0/servers?search=com.santosautomation/site-audit"><strong>Official MCP Registry</strong><span>com.santosautomation/site-audit — verify the remote URL</span></a><a href={`${API}/mcp`}><strong>MCP endpoint</strong><span>Streamable HTTP · seven tools · strict schemas</span></a>
            <a href="/openapi.json" data-analytics-event="openapi_downloaded"><strong>OpenAPI 3.1</strong><span>Typed operations, schemas, errors, and x402 behavior</span></a>
            <a href="/.well-known/agent-capabilities.json"><strong>Capability manifest</strong><span>Selection guidance, pricing, limits, and support</span></a>
            <a href="/llms.txt"><strong>llms.txt</strong><span>Low-noise service guide and canonical machine links</span></a>
            <a href="/version"><strong>/version</strong><span>Current API version and contract URLs</span></a>
            <a href="/status"><strong>/status</strong><span>Live availability of every capability</span></a>
          </div>
        </section>

        <section className="content-section related">
          <h2>Continue</h2>
          <div className="related-links">
            <a href="/integrations/claude">Claude — same endpoint, different setup<span aria-hidden="true"> →</span></a>
            <a href="/docs">API documentation<span aria-hidden="true"> →</span></a>
            <a href="/ci">Gate pull requests on agent readiness<span aria-hidden="true"> →</span></a>
            <a href="/methodology/agent-readiness">Scoring methodology<span aria-hidden="true"> →</span></a>
            <a href="/changelog">Changelog<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
