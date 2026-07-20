import { PageShell } from "../components/SiteChrome.js";
import StructuredData from "../components/StructuredData.js";
import { pageMetadata } from "../../lib/marketing-content.js";
import { getAgentReadinessPriceUsdc } from "../../lib/agent-readiness/product-pricing.js";

const API = "https://api.santosautomation.com";
const readinessPrice = getAgentReadinessPriceUsdc();

const PAGE = {
  path: "/docs",
  title: "API Documentation — Santos Website Intelligence",
  description:
    "Complete developer documentation for the Santos Website Intelligence API: seven x402-payable capabilities on Base, free daily demos, MCP, OpenAPI, errors, and limits.",
};

export const metadata = pageMetadata(PAGE);

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "APIReference",
      "@id": "https://www.santosautomation.com/docs#reference",
      name: "Santos Website Intelligence API Documentation",
      url: "https://www.santosautomation.com/docs",
      description: PAGE.description,
      programmingModel: "REST + x402 v2 + MCP",
      targetPlatform: "HTTP",
      about: { "@id": "https://api.santosautomation.com/#api" },
      provider: { "@id": "https://www.santosautomation.com/#organization" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.santosautomation.com/" },
        { "@type": "ListItem", position: 2, name: "Documentation", item: "https://www.santosautomation.com/docs" },
      ],
    },
  ],
};

const TOC = [
  ["#quickstart", "Quickstart"],
  ["#payment", "Paying with x402"],
  ["#endpoints", "Capability reference"],
  ["#mcp", "MCP server"],
  ["#robots", "For robots"],
  ["#errors", "Errors & limits"],
  ["#roadmap", "Roadmap"],
];

const CAPABILITIES = [
  {
    id: "fetch",
    name: "Safe Fetch",
    method: "GET",
    path: "/v1/fetch",
    price: process.env.SAFE_FETCH_PRICE_USDC ?? "0.002",
    mode: "Synchronous",
    settles: "on a successful fetch",
    summary:
      "One URL in, raw text body out through a hardened SSRF-guarded fetcher — final URL after redirects, HTTP status, selected headers, byte count, and timing included. Text formats only: HTML, JSON, XML, feeds, plain text, JavaScript, SVG. A POST variant accepts a JSON {\"url\"} body.",
    params: [["url", "required — public HTTP/HTTPS URL, max 2048 chars"]],
    curl: `curl '${API}/v1/fetch?url=https%3A%2F%2Fexample.com%2Ffeed.xml'`,
    demo: "GET /v1/fetch/demo",
  },
  {
    id: "extract",
    name: "Content Extraction",
    method: "POST",
    path: "/v1/extract",
    price: process.env.EXTRACT_PRICE_USDC ?? "0.005",
    mode: "Synchronous",
    settles: "on a successful extraction",
    summary:
      "One public page in, clean readability-isolated Markdown out — plus title, description, canonical URL, outbound links, and word count. Built for RAG ingestion, research agents, and summarization pipelines. A GET ?url= variant is paywalled identically. No crawling, no JavaScript rendering.",
    params: [["url", "required — public HTTP/HTTPS page"]],
    curl: `curl -X POST ${API}/v1/extract \\
  -H 'Content-Type: application/json' \\
  -d '{"url": "https://example.com/article"}'`,
    demo: "GET /v1/extract/demo",
  },
  {
    id: "screenshot",
    name: "Screenshot & PDF Render",
    method: "GET",
    path: "/v1/screenshot",
    price: process.env.SCREENSHOT_PRICE_USDC ?? "0.01",
    mode: "Synchronous",
    settles: "only when render bytes are returned",
    summary:
      "A real isolated Chromium browser renders the page — JavaScript executed, so SPAs, client-rendered charts, and post-load layout are captured — and returns PNG, JPEG, or PDF bytes directly with an X-Render-Job header. Every render is a fresh anonymous visitor: no cookies, no login-protected content. A cold worker wakes on demand and may 504 the first try — retry once; timeouts are never charged.",
    params: [
      ["url", "required — public HTTP/HTTPS page"],
      ["format", "png (default) · jpeg · pdf"],
      ["device", "desktop 1366×900 (default) · mobile 390×844 @3x with touch"],
      ["full_page", "true captures the whole page height (ignored for pdf)"],
    ],
    curl: `curl '${API}/v1/screenshot?url=https%3A%2F%2Fexample.com&format=png&device=desktop' \\
  --output page.png`,
  },
  {
    id: "quick",
    name: "Quick Intelligence Audit",
    method: "GET",
    path: "/api/audit",
    price: "0.015",
    mode: "Synchronous",
    settles: "on a successful audit",
    summary:
      "Fast fetch-and-parse audit of a single public page: 0–100 scores for performance, SEO, accessibility markup, and security headers, an additive website_intelligence_score across Discoverable / Understandable / Callable / Trustworthy, every individual check with pass/fail detail, and a flat issues list of plain-English fixes safe to show a user or another agent.",
    params: [["url", "required — public HTTP/HTTPS page"]],
    curl: `curl '${API}/api/audit?url=https%3A%2F%2Fexample.com'`,
    demo: "GET /api/audit/demo",
  },
  {
    id: "agent-readiness",
    name: "Agent Readiness Audit",
    method: "GET",
    path: "/api/agent-readiness",
    price: readinessPrice,
    mode: "Synchronous",
    settles: "on a successful audit",
    summary:
      "Bounded passive assessment of whether AI agents can discover, understand, select, invoke, and — when applicable — transact with a public service. Classifies the target first so ordinary websites are not penalized for lacking OpenAPI, MCP, or machine commerce. At most eight extra public requests; never authenticates, submits forms, invokes target tools, or sends a payment to the audited site. Humans can alternatively buy a one-time $5 report by card.",
    params: [
      ["url", "required — public HTTP/HTTPS page"],
      ["depth", "quick (default and currently the only depth)"],
    ],
    curl: `curl '${API}/api/agent-readiness?url=https%3A%2F%2Fexample.com&depth=quick'`,
  },
  {
    id: "structured",
    name: "Structured Extraction",
    method: "POST",
    path: "/v1/extract/structured",
    price: process.env.STRUCTURED_EXTRACT_PRICE_USDC ?? "0.08",
    mode: "Synchronous",
    settles: "only when the output validates against your schema",
    summary:
      "Send a page URL and your own JSON Schema; an LLM extracts matching fields from the page content and the result is re-validated against your schema before you are charged — non-conforming output returns 422 and costs nothing. Your schema must be a self-contained object (no $ref) under 4000 characters. Page content is truncated to 8000 characters before extraction; model output is capped at 1024 tokens. POST only.",
    params: [
      ["url", "required — public HTTP/HTTPS page"],
      ["schema", "required — self-contained JSON Schema object describing the fields to extract"],
    ],
    curl: `curl -X POST ${API}/v1/extract/structured \\
  -H 'Content-Type: application/json' \\
  -d '{
    "url": "https://example.com/pricing",
    "schema": {
      "type": "object",
      "properties": {
        "product": { "type": "string" },
        "price_usd": { "type": "number" }
      },
      "required": ["product"]
    }
  }'`,
    demo: "POST /v1/extract/structured/demo",
  },
  {
    id: "deep",
    name: "Deep Website Intelligence Audit",
    method: "POST",
    path: "/v1/audits",
    price: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225",
    mode: "Asynchronous job",
    settles: "when the job is accepted (201) — a bounded compute reservation",
    summary:
      "A real Chromium browser runs Lighthouse mobile lab metrics, rendered axe-core accessibility checks with selectors, network and console evidence, screenshots, and passive security analysis. The 201 response returns job_id, a one-time access_token (save it — it is shown only once), status_url, and report_url. Poll status_url; fetch the versioned report when status is completed. Send an Idempotency-Key header — a retry with the same key and body returns the existing job without a second charge.",
    params: [
      ["url", "required — public HTTP/HTTPS page (JSON body)"],
      ["devices", "optional — [\"mobile\"] (default) and/or \"desktop\""],
      ["modules", "optional — lighthouse · accessibility · browser-network · security-passive · agent-readiness · ai-summary"],
      ["Idempotency-Key", "header, strongly recommended — dedupes retries free of charge"],
    ],
    curl: `curl -X POST ${API}/v1/audits \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: my-unique-key-001' \\
  -d '{"url": "https://example.com"}'

# then, with the returned access_token:
curl '${API}/v1/audits/JOB_ID?token=ACCESS_TOKEN'          # status
curl '${API}/v1/audits/JOB_ID/report?token=ACCESS_TOKEN'   # completed report`,
  },
];

const ERROR_ROWS = [
  ["PAYMENT_REQUIRED", "402", "No or invalid payment; full terms are in the PAYMENT-REQUIRED header"],
  ["AUDIT_FAILED", "400", "Invalid or blocked target URL, or a general audit failure"],
  ["URL_TOO_LONG", "414", "Target URL exceeds 2048 characters"],
  ["UNSUPPORTED_CONTENT_TYPE", "415", "Target returned a non-text content type"],
  ["RESPONSE_TOO_LARGE / TOO_MANY_REDIRECTS", "422", "Target exceeded the 5 MB cap (2 MB for Safe Fetch) or 5-redirect limit"],
  ["INVALID_EXTRACTION_SCHEMA", "400", "Structured Extraction: caller schema is missing, oversized, non-object, or uncompilable"],
  ["STRUCTURED_OUTPUT_INVALID", "422", "Structured Extraction: model output did not conform to your schema (not charged)"],
  ["RATE_LIMITED", "429", "Free demo quota exhausted (1/day per IP, shared across all demos)"],
  ["TARGET_UNREACHABLE", "502", "Target site could not be reached (not charged)"],
  ["SERVICE_UNAVAILABLE", "503", "Deep/render tier temporarily has no worker available (not charged)"],
  ["AUDIT_TIMEOUT", "504", "Bounded operation timed out (not charged — retry renders once)"],
];

const MACHINE_SURFACES = [
  ["OpenAPI 3.1", `${API}/openapi.json`, "Typed operations, request/response schemas, error models, and x402 behavior for every endpoint"],
  ["llms.txt", `${API}/llms.txt`, "Low-noise plain-text service guide with canonical machine links and agent selection guidance"],
  ["MCP server", `${API}/mcp`, "Streamable HTTP; tools: audit_website_preview, audit_agent_readiness, extract_page_markdown, extract_structured_data"],
  ["Capability manifest", `${API}/capabilities.json`, "Vendor-specific manifest: tier selection guidance, pricing, limits, and support"],
  ["Agent capabilities", "https://www.santosautomation.com/.well-known/agent-capabilities.json", "Well-known agent-capabilities document"],
  ["Service manifest", `${API}/api`, "Live service description and pricing at the API root"],
];

function CapabilityCard({ cap }) {
  return (
    <article className="doc-endpoint" id={cap.id}>
      <div className="doc-endpoint-head">
        <h3>{cap.name}</h3>
        <p className="doc-endpoint-route">
          <span className="pill">{cap.method}</span> <code>{cap.path}</code>
        </p>
        <p className="doc-endpoint-price">${cap.price} <span>USDC · {cap.mode} · settles {cap.settles}</span></p>
      </div>
      <p className="doc-endpoint-summary">{cap.summary}</p>
      <dl className="doc-params">
        {cap.params.map(([name, desc]) => (
          <div key={name}><dt><code>{name}</code></dt><dd>{desc}</dd></div>
        ))}
      </dl>
      <pre className="code-sample" tabIndex={0}><code>{cap.curl}</code></pre>
      {cap.demo && <p className="doc-demo-note">Free demo: <code>{cap.demo}</code> — same response shape, 1/day per IP (quota shared across all demos).</p>}
    </article>
  );
}

export default function DocsPage() {
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Documentation</span></div>
      <header className="page-hero">
        <p className="kicker">Documentation · for humans and robots</p>
        <h1>Santos API documentation</h1>
        <p className="lede">
          Everything you need to call the Santos Website Intelligence API: seven machine-payable
          capabilities on Base mainnet, free daily demos, a remote MCP server, and stable
          machine-readable contracts. No account and no traditional API key — payment happens
          inside the HTTP request via x402.
        </p>
        <div className="cta-row">
          <a className="btn primary" href="#quickstart">Start in 30 seconds</a>
          <a className="btn" href="/openapi.json" data-analytics-event="openapi_downloaded">OpenAPI 3.1</a>
          <a className="btn" href="/llms.txt">llms.txt</a>
        </div>
        <nav className="inline-links doc-toc" aria-label="On this page">
          {TOC.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
      </header>

      <section className="content-section" id="quickstart">
        <p className="section-label">01 · Quickstart</p>
        <h2>First call in 30 seconds</h2>
        <p className="sub wide">
          Every paid capability has a free demo sharing one daily quota (1 request per day per IP),
          returning the exact same response shape as the paid tier — inspect the format before
          integrating payment.
        </p>
        <pre className="code-sample" tabIndex={0}><code>{`# Free demo — no payment, no account (1/day per IP)
curl '${API}/api/audit/demo?url=https%3A%2F%2Fexample.com'

# Paid tier — any x402 v2 client automates payment:
npm install @x402/fetch @x402/evm viem`}</code></pre>
        <pre className="code-sample" tabIndex={0}><code>{`import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY); // holds USDC on Base
const fetchWithPay = wrapFetchWithPayment(fetch, [new ExactEvmScheme(account)]);

const res = await fetchWithPay(
  "${API}/api/audit?url=https%3A%2F%2Fexample.com"
);
const report = await res.json(); // paid, settled, done`}</code></pre>
      </section>

      <section className="content-section" id="payment">
        <p className="section-label">02 · Payment</p>
        <h2>Paying with x402</h2>
        <p className="sub wide">
          An unpaid request returns HTTP 402 with full machine-readable terms — before any payment
          moves. Sign an EIP-3009 <code>transferWithAuthorization</code> for the quoted amount and
          retry. Payment settles <strong>only after a successful response</strong>: failed audits,
          unreachable targets, timeouts, and non-conforming extractions cost nothing.
        </p>
        <div className="flow">
          <span className="c"># The three-step flow (automated by any x402 v2 client)</span><br />
          GET /api/audit?url=example.com<br />
          <span className="a">← 402 · PAYMENT-REQUIRED header (base64 JSON: amount, asset, payTo, network)</span><br />
          → retry with PAYMENT-SIGNATURE header (signed EIP-3009 authorization)<br />
          <span className="g">← 200 · result + PAYMENT-RESPONSE header (base64 on-chain receipt)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Term</th><th scope="col">Value</th></tr></thead>
            <tbody>
              <tr><th scope="row">Protocol</th><td>x402 v2 (v1 X-PAYMENT clients are not supported)</td></tr>
              <tr><th scope="row">Network</th><td><code>eip155:8453</code> — Base mainnet</td></tr>
              <tr><th scope="row">Asset</th><td>USDC · <code>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code></td></tr>
              <tr><th scope="row">Pay to</th><td><code>0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B</code></td></tr>
              <tr><th scope="row">Scheme</th><td><code>exact</code> — the 402 quotes the exact atomic USDC amount</td></tr>
              <tr><th scope="row">Human option</th><td>No wallet? A one-time <a href="/agent-readiness/buy">$5 Agent Readiness Report by card</a> (Stripe), emailed as a private link</td></tr>
            </tbody>
          </table>
        </div>
        <p className="sub sub--tight">
          The 402 also carries an x402 Bazaar discovery extension with input/output JSON Schemas, so
          catalogs can index each resource automatically.
        </p>
      </section>

      <section className="content-section" id="endpoints">
        <p className="section-label">03 · Capability reference</p>
        <h2>Seven capabilities, one payment model</h2>
        <p className="sub wide">
          All prices are USDC per <em>successful</em> call. Every capability audits or processes one
          public page per call — no crawling, no login-protected content, private networks blocked.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Capability</th><th scope="col">Endpoint</th><th scope="col">Price</th><th scope="col">Mode</th></tr></thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap.id}>
                  <th scope="row"><a href={`#${cap.id}`}>{cap.name}</a></th>
                  <td><code>{cap.method} {cap.path}</code></td>
                  <td>${cap.price}</td>
                  <td>{cap.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="doc-endpoint-list">
          {CAPABILITIES.map((cap) => <CapabilityCard key={cap.id} cap={cap} />)}
        </div>
      </section>

      <section className="content-section" id="mcp">
        <p className="section-label">04 · MCP</p>
        <h2>Remote MCP server</h2>
        <p className="sub wide">
          Agent-native discovery and invocation over Streamable HTTP at <code>{API}/mcp</code> —
          published in the MCP Registry as <code>com.santosautomation/site-audit</code>. Free tools
          share the daily demo quota; paid tools return the canonical x402 HTTP handoff.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Tool</th><th scope="col">What it does</th></tr></thead>
            <tbody>
              <tr><th scope="row"><code>audit_website_preview</code></th><td>Free Quick Audit preview (shares the 1/day demo quota)</td></tr>
              <tr><th scope="row"><code>audit_agent_readiness</code></th><td>Validates the target and returns the paid x402 handoff terms</td></tr>
              <tr><th scope="row"><code>extract_page_markdown</code></th><td>Free page-to-Markdown extraction (shared demo quota)</td></tr>
              <tr><th scope="row"><code>extract_structured_data</code></th><td>Free structured extraction against your JSON Schema (shared demo quota)</td></tr>
            </tbody>
          </table>
        </div>
        <pre className="code-sample" tabIndex={0}><code>{`curl -X POST ${API}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</code></pre>
      </section>

      <section className="content-section" id="robots">
        <p className="section-label">05 · For robots</p>
        <h2>Machine-readable surfaces</h2>
        <p className="sub wide">
          Agents should not need this page. Every contract on it is published in a machine-readable
          form at a stable URL — these are the canonical sources, updated before any human-facing copy.
        </p>
        <div className="integration-grid doc-surfaces">
          {MACHINE_SURFACES.map(([name, url, desc]) => (
            <a key={name} href={url}><strong>{name}</strong><span>{desc}</span></a>
          ))}
        </div>
        <p className="sub sub--tight">
          Also discoverable via: x402 Bazaar and x402scan listings for every paid endpoint, JSON-LD
          WebAPI markup with USDC Offers on this site, WebMCP tools registered in the browser via{" "}
          <code>navigator.modelContext</code>, and explicit robots.txt Allow rules for every agent
          endpoint.
        </p>
      </section>

      <section className="content-section" id="errors">
        <p className="section-label">06 · Errors & limits</p>
        <h2>Stable errors, explicit bounds</h2>
        <p className="sub wide">
          Every error is JSON with a human-readable <code>error</code> message and a stable
          machine-readable <code>code</code>. Anything that is not a successful response is not charged.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Code</th><th scope="col">HTTP</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              {ERROR_ROWS.map(([code, status, meaning]) => (
                <tr key={code}><th scope="row"><code>{code}</code></th><td>{status}</td><td>{meaning}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="check-list doc-limits">
          <li>Targets: public HTTP/HTTPS only, ports 80/443; localhost, private-network, link-local, and cloud-metadata addresses rejected — including via redirects</li>
          <li>15-second fetch timeout · 5 redirects max · 5 MB response cap (2 MB for Safe Fetch) · 2048-character URL cap</li>
          <li>Free demos: 1 request per day per IP, shared across all demo endpoints</li>
          <li>Platform rate limit: 240 requests/minute per IP across all API routes</li>
          <li>Quick tiers do not execute JavaScript; Screenshot and Deep tiers use a real browser</li>
        </ul>
      </section>

      <section className="content-section" id="roadmap">
        <p className="section-label">07 · Roadmap</p>
        <h2>The suite keeps growing</h2>
        <p className="sub wide">
          The API grew from one audit endpoint to seven capabilities, and we plan to add new
          features and capabilities as time allows. Everything ships under the same contract:
          read-only, one-shot, single-page, x402 pay-per-success — no subscriptions, no accounts,
          no endpoints that send messages or act on your behalf.
        </p>
        <div className="callout">
          <h2>How to track new capabilities</h2>
          <p className="sub sub--tight">
            New endpoints always land in <a href="/openapi.json">openapi.json</a> and{" "}
            <a href="/llms.txt">llms.txt</a> first, appear automatically in x402 discovery catalogs,
            and are announced on this page. Have a capability you wish existed? Email{" "}
            <a href="mailto:info@santosautomation.com">info@santosautomation.com</a> — real
            integration needs move ideas up the list.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
