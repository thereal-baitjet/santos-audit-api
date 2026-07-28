import { PageShell } from "../../components/SiteChrome.js";
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
  title: "Grok & xAI Integration — Remote MCP Website Intelligence | Santos",
  description:
    "Add the Santos MCP server to Grok in one line. Seven website-intelligence tools over Streamable HTTP: free previews need no wallet, paid tools return a canonical x402 handoff that settles in USDC on Base only on success.",
  alternates: { canonical: "/integrations/grok" },
};

const MCP_SNIPPET = `from xai_sdk.tools import mcp

tools = [
    mcp(
        server_url="${API}/mcp",
        server_label="santos",
    )
]`;

const LIST_TOOLS = `curl -X POST ${API}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

const HANDOFF = `{
  "payment_required": true,
  "method": "GET",
  "url": "${API}/api/agent-readiness?url=https%3A%2F%2Fexample.com&depth=quick",
  "price_usdc": "${readiness}",
  "network": "eip155:8453",
  "protocol": "x402-v2",
  "settles": "only on a successful (2xx) response"
}`;

const SETTLE = `// Any x402 v2 client settles the handoff. Node example:
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{
    network: "eip155:8453",
    client: new ExactEvmScheme(privateKeyToAccount(process.env.X402_PRIVATE_KEY)),
  }],
});

// handoff.url came from the MCP tool result above.
const res = await fetchWithPay(handoff.url);
const report = await res.json();
console.log(report.website_intelligence_score);`;

export default function GrokIntegrationPage() {
  return (
    <PageShell>
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
            tool list — no account, no API key, no server to run. Free previews need no wallet.
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
            context; <code>santos</code> keeps traces readable. Verify the same list the model
            sees, from your own shell:
          </p>
          <pre className="code-sample" tabIndex={0}><code>{LIST_TOOLS}</code></pre>
        </section>

        <section className="content-section">
          <p className="section-label">Step two</p>
          <h2>What Grok sees</h2>
          <p className="sub wide">
            Seven tools. The three free previews execute and return a full result inline. The four
            paid tools validate the target and return the canonical x402 HTTP request — they never
            move funds themselves.
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
            All prices are USDC on Base mainnet (<code>eip155:8453</code>). The three free previews
            share one quota: <strong>one call per day per IP</strong>. A hosted agent shares that
            pool with everything else calling from the same address, so treat the free tier as
            evaluation, not capacity.
          </p>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>Start free, no wallet</h2>
            <p>
              Ask Grok to audit a URL and it will reach for{" "}
              <code>audit_website_preview</code> on its own. That call executes end to end and
              returns scores, pass/fail checks, and remediation guidance inline — no payment, no
              wallet, no configuration beyond the one line above. Same for{" "}
              <code>extract_page_markdown</code> and <code>extract_structured_data</code>. This is
              the fastest way to confirm the wiring works before a key is ever involved.
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
          <p className="section-label">Step three</p>
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
          <p className="sub wide">The tool result is shaped like this:</p>
          <pre className="code-sample" tabIndex={0}><code>{HANDOFF}</code></pre>
          <p className="sub wide">
            Settling it is a single wrapped <code>fetch</code>. Any x402 v2 client works; the
            payment step is identical to the one in the{" "}
            <a href="/ci">CI recipe</a>.
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
            <a href={`${API}/mcp`}><strong>MCP endpoint</strong><span>Streamable HTTP · seven tools · strict schemas</span></a>
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
