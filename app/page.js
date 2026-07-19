import AuditWidget from "./AuditWidget.js";
import { PageShell } from "./components/SiteChrome.js";
import StructuredData from "./components/StructuredData.js";
import { DIMENSIONS, FAQS } from "../lib/marketing-content.js";
import { getAgentReadinessPriceUsdc } from "../lib/agent-readiness/product-pricing.js";

const readinessPrice = getAgentReadinessPriceUsdc();
const homepageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebAPI",
  "@id": "https://api.santosautomation.com/#api",
  name: "Santos Website Intelligence API",
  alternateName: "Santos Agent Readiness API",
  url: "https://api.santosautomation.com/api",
  documentation: "https://api.santosautomation.com/openapi.json",
  termsOfService: "https://www.santosautomation.com/terms",
  provider: { "@id": "https://www.santosautomation.com/#organization" },
  serviceType: "AI Website Intelligence API",
  description: "An API that measures whether websites can be discovered, understood, trusted, and used by AI agents.",
  offers: [
    { "@type": "Offer", name: "Quick Intelligence Audit", price: "0.015", priceCurrency: "USDC", url: "https://api.santosautomation.com/api/audit" },
    { "@type": "Offer", name: "Agent Readiness Audit", price: readinessPrice, priceCurrency: "USDC", url: "https://api.santosautomation.com/api/agent-readiness" },
    { "@type": "Offer", name: "Deep Website Intelligence Audit", price: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.225", priceCurrency: "USDC", url: "https://api.santosautomation.com/v1/audits" },
    { "@type": "Offer", name: "Page-to-Markdown Extraction", price: process.env.EXTRACT_PRICE_USDC ?? "0.005", priceCurrency: "USDC", url: "https://api.santosautomation.com/v1/extract" },
    { "@type": "Offer", name: "Safe Fetch", price: process.env.SAFE_FETCH_PRICE_USDC ?? "0.002", priceCurrency: "USDC", url: "https://api.santosautomation.com/v1/fetch" },
    { "@type": "Offer", name: "Agent Readiness Report by card (human checkout)", price: "5", priceCurrency: "USD", url: "https://www.santosautomation.com/agent-readiness/buy" },
  ],
};
const capabilityGroups = [
  ["Agent interfaces", "Agent Readiness · MCP discovery and tool schemas · MCP resources · OpenAPI discovery and validation · capability manifests · x402 readiness"],
  ["Machine discovery", "llms.txt · AI crawler access · robots.txt · XML sitemaps · canonical URLs · documentation links · Schema.org and JSON-LD"],
  ["Page intelligence", "Semantic HTML · technical SEO · accessibility · browser behavior · performance · security headers · broken requests"],
  ["Identity and trust", "Business identity · transparent pricing · contact and support · error models · limitations · evidence quality"],
];

const outputExample = `{
  "website_intelligence_score": 82,
  "website_intelligence": {
    "dimensions": {
      "discoverable": 91,
      "understandable": 78,
      "callable": 73,
      "trustworthy": 86
    },
    "applicability": { "callable": "tested" },
    "coverage": { "tests_executed": 36, "tested_percent": 90 },
    "confidence": 0.91,
    "priority_fixes": [
      { "severity": "high", "confidence": "high",
        "recommendation": "Publish a complete capability manifest." }
    ]
  },
  "overall_score": 80,
  "scores": { "performance": 84, "seo": 88,
    "accessibility": 76, "security": 72 }
}`;

export default function Home() {
  return (
    <PageShell>
      <StructuredData data={homepageJsonLd} />
      <header className="hero">
        <div className="hero-copy">
          <p className="kicker">Website intelligence for the agentic web</p>
          <h1>AI website intelligence in one API.</h1>
          <p className="lede">Measure whether any website can be discovered, understood, trusted and used by AI agents. Santos audits MCP, llms.txt, OpenAPI, structured metadata, crawler access, browser behavior, technical SEO, accessibility, performance and security—then returns structured JSON with evidence and prioritized fixes.</p>
          <p className="brand-line">From discoverable to callable.</p>
          <div className="cta-row">
            <a className="btn primary" href="/agent-readiness/run">Run the Agent Readiness Audit</a>
            <a className="btn" href="#audit" data-analytics-event="free_audit_started">Run Free Quick Audit</a>
            <a className="btn" href="/website-intelligence-api" data-analytics-event="openapi_downloaded">Explore API Documentation</a>
          </div>
          <p className="proof-line">Quick scans in seconds · Browser-rendered deep audits · MCP and OpenAPI discovery · Structured JSON · x402 pay per call</p>
        </div>
        <img className="hero-eagle" src="/assets/santos-eagle.svg" alt="Gold geometric eagle emblem for Santos Website Intelligence" width="1254" height="1254" fetchPriority="high" />
      </header>

      <div className="home-content">
        <section className="content-section" id="layers"><p className="section-label">01 · Intelligence model</p><h2>Four layers between being online and being usable</h2><p className="sub wide">Each dimension answers a different technical question. Callable checks are applicability-aware, so an informational site is not penalized for not exposing an API.</p><div className="dimension-grid">{DIMENSIONS.map((item, index) => <article className="dimension-card" key={item.name}><span>0{index + 1}</span><h3>{item.name}</h3><p>{item.text}</p></article>)}</div></section>

        <section className="content-section" id="checks"><p className="section-label">02 · Coverage</p><h2>What Santos checks</h2><div className="capability-grid">{capabilityGroups.map(([heading, text]) => <article key={heading}><h3>{heading}</h3><p>{text}</p></article>)}</div><div className="inline-links" aria-label="Technical checkers"><a href="/mcp-readiness-checker">MCP readiness checker</a><a href="/llms-txt-checker">llms.txt checker</a><a href="/openapi-readiness-checker">OpenAPI readiness checker</a></div><p className="sub sub--tight">Every result records observed evidence, status, applicability, confidence, limitations, and the next highest-impact fixes.</p></section>

        <section className="content-section" id="modes"><p className="section-label">03 · Audit depth</p><h2>Quick triage or browser-rendered evidence</h2><div className="compare-grid"><article><p className="pill">Synchronous</p><h3>Quick Intelligence Audit</h3><p>Fast fetch-and-parse signals for a single public page: timing, HTML weight, SEO, accessibility markup, security headers, and an additive embedded Agent Readiness view.</p><ul className="check-list"><li>Returns in seconds</li><li>Structured 0–100 scores and fixes</li><li>0.015 USDC per successful paid audit</li></ul></article><article><p className="pill">Asynchronous</p><h3>Deep Website Intelligence Audit</h3><p>A real isolated browser adds Lighthouse lab metrics, rendered axe-core findings, screenshots, network and console evidence, and passive security analysis.</p><ul className="check-list"><li>Typically tens of seconds to minutes</li><li>Versioned job, report, and artifact flow</li><li>0.225 USDC per compute reservation</li></ul></article></div><p className="sub sub--tight">Both modes assess one page, not a whole-site crawl. Lab data is not field data, and automated accessibility checks do not certify WCAG conformance.</p></section>

        <section className="content-section split-section" id="output"><div><p className="section-label">04 · Structured output</p><h2>Evidence your workflow can use</h2><p className="sub wide">The new presentation fields are additive. Established <code>overall_score</code>, category scores, endpoints, and internal identifiers remain compatible with existing clients.</p><a href="/reports/sample-agent-readiness">Explore the annotated sample report →</a></div><pre className="code-sample" tabIndex={0}><code>{outputExample}</code></pre></section>

        <section className="content-section" id="use-cases"><p className="section-label">05 · Use cases</p><h2>Built for teams making the web agent-ready</h2><div className="feature-grid five-up"><article className="feature-card"><h3>AI-agent developers</h3><p>Evaluate public interfaces before adding them to a tool registry or autonomous workflow.</p></article><article className="feature-card"><h3>Agencies</h3><p>Turn a URL into traceable technical evidence and a prioritized implementation backlog.</p></article><article className="feature-card"><h3>SaaS teams</h3><p>Check whether product docs, APIs, payment rules, and identity claims stay consistent.</p></article><article className="feature-card"><h3>Technical SEO teams</h3><p>Extend crawl and content foundations into structured meaning and machine capabilities.</p></article><article className="feature-card"><h3>Automation platforms</h3><p>Consume versioned JSON without opening accounts or distributing traditional API keys.</p></article></div></section>

        <section className="content-section" id="integration"><p className="section-label">06 · Developer integration</p><h2>Public contracts, predictable payment, no account</h2><div className="integration-grid"><a href="/openapi.json" data-analytics-event="openapi_downloaded"><strong>OpenAPI 3.1</strong><span>Typed operations, schemas, errors, and x402 behavior</span></a><a href="/mcp-readiness-checker" data-analytics-event="mcp_documentation_viewed"><strong>MCP</strong><span>Streamable HTTP discovery and paid audit handoff</span></a><a href="/.well-known/agent-capabilities.json"><strong>Capability manifest</strong><span>Selection guidance, pricing, limits, and support</span></a><a href="/llms.txt"><strong>llms.txt</strong><span>Low-noise service guide and canonical machine links</span></a></div><div className="flow"><span className="c"># Agent Readiness · synchronous</span><br />GET /api/agent-readiness?url=example.com&amp;depth=quick<br /><span className="a">← 402 · PAYMENT-REQUIRED · {readinessPrice} USDC · eip155:8453</span><br />→ retry with PAYMENT-SIGNATURE <span className="c">(any x402 v2 client can automate this)</span><br /><span className="g">← 200 · versioned evidence + PAYMENT-RESPONSE receipt</span></div></section>

        <section className="content-section" id="methodology"><p className="section-label">07 · Methodology</p><h2>Scored by applicability, grounded in public evidence</h2><div className="prose-grid"><div><h3>Classify first</h3><p>General websites, documentation, APIs, MCP providers, and commerce services do not need the same interfaces. Non-applicable categories leave the denominator.</p></div><div><h3>Expose coverage</h3><p>Passed, failed, unknown, skipped, and not-applicable states stay visible alongside confidence and the exact discovered interfaces.</p></div><div><h3>Keep scoring deterministic</h3><p>Published rules and weights drive numeric results. AI summaries, when requested in Deep audits, never change scores or pass/fail status.</p></div><div><h3>State the limits</h3><p>Public, passive, single-page evidence is not certification, a vulnerability scan, or a promise of visibility in AI-generated answers.</p></div></div><div className="cta-row"><a className="btn" href="/methodology/agent-readiness">Read the full scoring methodology</a><a className="btn" href="/learn/agent-ready-website-checklist">Use the agent-ready checklist</a></div><div className="guide-links" aria-label="Website Intelligence field guides"><a href="/learn/what-is-ai-website-intelligence">What is AI Website Intelligence?</a><a href="/learn/what-is-agent-readiness">What makes a website agent-ready?</a><a href="/learn/mcp-vs-openapi">MCP vs OpenAPI</a><a href="/learn/llms-txt-vs-robots-txt">llms.txt vs robots.txt</a><a href="/learn/how-ai-agents-discover-capabilities">How agents discover capabilities</a><a href="/learn/structured-data-for-ai-agents">Structured data for AI agents</a><a href="/learn/from-discoverable-to-callable">From discoverable to callable</a><a href="/learn/agent-ready-website-checklist">Agent-ready website checklist</a></div></section>

        <section className="content-section audit" id="audit"><p className="section-label">08 · Live entry point</p><h2>Free browser demo — one scan per day</h2><p className="sub wide">This is the free daily demo (one scan per day per IP; a shared office, VPN, or network may share that limit). It inspects the report shape only. For unlimited synchronous audits use the production Quick API at 0.015 USDC per success, and for bounded agent-interface evidence run the <a href="/agent-readiness/run">paid Agent Readiness audit</a> at {readinessPrice} USDC per success. The same daily quota also covers one free <a href="/website-intelligence-api">page-to-Markdown extraction</a> at GET /v1/extract/demo.</p><div className="audit-box"><AuditWidget /></div></section>

        <section className="content-section" id="pricing" data-analytics-event="pricing_viewed"><p className="section-label">09 · Transparent pricing</p><h2>Pricing built for agents</h2><p className="sub wide">No subscription and no traditional API key. Five x402 capabilities on Base (no account), from <strong>$0.002 hardened raw fetches</strong> to <strong>$0.225 browser-rendered reports</strong>. For humans, there is also an optional one-time <a href="/agent-readiness/buy">$5 Agent Readiness Report by card</a>, emailed to you. x402 terms are returned before payment, and the audited target is never paid by Santos during discovery.</p><div className="plan-grid"><article className="plan plan--fetch"><div className="plan-head"><h3>Safe Fetch</h3><div className="plan-price">$0.002 <span>USDC / success</span></div><div className="plan-mode">GET /v1/fetch</div></div><p className="plan-pitch">One URL in, raw body out through an SSRF-guarded fetcher — redirects, headers, and timing included.</p></article><article className="plan plan--extract"><div className="plan-head"><h3>Content Extraction</h3><div className="plan-price">$0.005 <span>USDC / success</span></div><div className="plan-mode">POST /v1/extract</div></div><p className="plan-pitch">One public page in, clean Markdown out — title, links, and metadata for RAG and research agents.</p></article><article className="plan"><div className="plan-head"><h3>Quick Intelligence</h3><div className="plan-price">$0.015 <span>USDC / success</span></div><div className="plan-mode">GET /api/audit</div></div><p className="plan-pitch">Fast single-page performance, SEO, accessibility markup, security, and structured fixes.</p></article><article className="plan plan--agent"><div className="plan-head"><h3>Agent Readiness</h3><div className="plan-price">${readinessPrice} <span>USDC / success</span></div><div className="plan-mode">GET /api/agent-readiness · or $5 by card</div></div><p className="plan-pitch">Bounded passive discovery of agent documentation, identity, OpenAPI, MCP, trust, and commerce. The main path for agents is <strong>{readinessPrice} USDC via x402</strong>; humans can optionally <a href="/agent-readiness/buy">buy the $5 report by card</a>.</p></article><article className="plan plan--deep"><div className="plan-head"><h3>Deep Intelligence</h3><div className="plan-price">$0.225 <span>USDC / reservation</span></div><div className="plan-mode">POST /v1/audits</div></div><p className="plan-pitch">Browser-rendered Lighthouse, axe-core, screenshots, network evidence, and passive security.</p></article></div><div className="cta-row"><a className="btn primary" href="/agent-readiness/run">Run Paid Agent Readiness Audit</a><a className="btn" href="#audit" data-analytics-event="free_audit_started">Run Free Quick Audit</a><a className="btn" href="/website-intelligence-api">Integrate the API</a></div></section>

        <section className="content-section" id="faq"><p className="section-label">10 · FAQ</p><h2>Questions about AI Website Intelligence</h2><div className="faq-list">{FAQS.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
      </div>
    </PageShell>
  );
}
