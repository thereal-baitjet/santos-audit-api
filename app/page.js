import AuditWidget from "./AuditWidget.js";
import { PageShell } from "./components/SiteChrome.js";
import StructuredData from "./components/StructuredData.js";
import ReportPreview from "./components/ReportPreview.js";
import { DIMENSIONS, FAQS } from "../lib/marketing-content.js";
import {
  PAID_CAPABILITY_COUNT,
  apiProduct,
  apiProducts,
  entryPriceUsdc,
  humanProducts,
  usdLabel,
} from "../lib/products.js";
import { INDEX_STATS } from "../lib/index-stats.js";

const api = apiProducts();
const humans = humanProducts();
const quick = apiProduct("quick-intelligence");
const deep = apiProduct("deep-intelligence");
const readiness = apiProduct("agent-readiness");
const quickReport = humans.find((product) => product.tier === "quick");
const deepReport = humans.find((product) => product.tier === "deep");
const monitoring = humans.find((product) => product.tier === "monitoring");

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
    ...api.map((product) => ({
      "@type": "Offer",
      name: product.name,
      price: product.priceUsdc,
      priceCurrency: "USDC",
      url: `https://api.santosautomation.com${product.route}`,
    })),
    ...humans.map((product) => ({
      "@type": "Offer",
      name: `${product.name} (human checkout, by card)`,
      price: String(product.priceUsd),
      priceCurrency: "USD",
      url: `https://www.santosautomation.com${product.url}`,
    })),
  ],
};
const founderJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.santosautomation.com/#founder",
  name: "Juan Santos",
  jobTitle: "Founder & Engineer, Santos Automation",
  worksFor: { "@id": "https://www.santosautomation.com/#organization" },
  address: { "@type": "PostalAddress", addressLocality: "Charlotte", addressRegion: "NC", addressCountry: "US" },
  image: "https://www.santosautomation.com/assets/santos-portrait.png",
  email: "info@santosautomation.com",
  sameAs: [
    "https://github.com/thereal-baitjet",
    "https://www.linkedin.com/in/santosjuanc/",
    "https://instagram.com/mr.j.c.santos",
  ],
};

export default function Home() {
  return (
    <PageShell>
      <StructuredData data={homepageJsonLd} />
      <StructuredData data={founderJsonLd} />
      <header className="hero">
        <div className="hero-copy">
          <p className="kicker">AI Website Intelligence</p>
          <h1>Is your website ready for <em>AI agents</em>?</h1>
          <p className="lede">Test whether AI systems can discover, understand, trust, and use your website. Get a scored report with evidence and prioritized fixes for agent readiness, SEO, accessibility, performance, and security.</p>
          <div className="cta-row">
            <a className="btn primary" href="#see-reports" data-analytics-event="hero_see_reports_clicked">See a Real Report</a>
            <a className="btn" href="/reports/sample-agent-readiness" data-analytics-event="sample_report_opened">View Sample Report</a>
          </div>
          <p className="proof-line">Quick scans in seconds · Browser-rendered deep audits · Structured JSON with evidence · HMAC-signed and verifiable</p>
          <p className="dev-line"><a href="/docs" data-analytics-event="api_docs_opened">Integrate the API</a> · x402 USDC on Base · no account · from {"$"}{entryPriceUsdc()} per call</p>
        </div>
        <img className="hero-eagle" src="/assets/santos-eagle.svg" alt="Gold geometric eagle emblem for Santos Website Intelligence" width="1254" height="1254" fetchPriority="high" />
      </header>

      <div className="home-content">
        <ReportPreview />

        <section className="content-section audit" id="see-reports"><p className="section-label">See the output</p><h2>Read a real report first</h2><p className="sub wide">Every domain below was audited with the same engine you would be buying — AI Website Intelligence score, the four dimensions, evidence, and prioritized fixes. Read one in full, then decide. Agents pay per call: the <a href="/pricing">Quick API at {"$"}{quick.priceUsdc} USDC per success</a>, or the <a href="/agent-readiness/run">Agent Readiness audit</a> at {readiness.priceUsdc} USDC per success.</p><div className="audit-box"><AuditWidget /></div></section>

        <section className="content-section" id="index"><p className="section-label">The Santos Index · {INDEX_STATS.edition}</p><h2>The web isn't agent-ready — yet.</h2><p className="sub wide">We audited {INDEX_STATS.auditedSiteCountLabel} of the world's best-known websites with the same engine that powers this API. Average AI Website Intelligence score: <strong>{INDEX_STATS.averageScore}/100</strong>. Median: <strong>{INDEX_STATS.medianScore}</strong>. {INDEX_STATS.examples[0].domain} scores <strong>{INDEX_STATS.examples[0].score}</strong>, {INDEX_STATS.examples[1].domain} <strong>{INDEX_STATS.examples[1].score}</strong>, {INDEX_STATS.examples[2].domain} <strong>{INDEX_STATS.examples[2].score}</strong> — while {INDEX_STATS.topDomain} leads at <strong>{INDEX_STATS.topScore}</strong>. Every report is public, HMAC-signed, and independently verifiable.</p><div className="cta-row"><a className="btn" href="/reports">Browse the leaderboard</a></div></section>

        <section className="content-section" id="layers"><p className="section-label">Intelligence model</p><h2>Four dimensions between being online and being usable</h2><p className="sub wide">Each dimension answers a different question. Callable checks are applicability-aware, so an informational site is not penalized for not exposing an API.</p><div className="dimension-grid">{DIMENSIONS.map((item, index) => <article className="dimension-card" key={item.name}><span>0{index + 1}</span><h3>{item.name}</h3><p>{item.text}</p></article>)}</div></section>

        <section className="content-section" id="modes"><p className="section-label">Audit depth</p><h2>Quick triage or browser-rendered evidence</h2><div className="compare-grid"><article><p className="pill">Fetch-based · seconds</p><h3>Quick</h3><p>Fast fetch-and-parse signals for a single public page: timing, HTML weight, SEO, accessibility markup, security headers, and an embedded Agent Readiness view.</p><ul className="check-list"><li>Returns in seconds</li><li>Structured 0–100 scores and fixes</li><li>{"$"}{quick.priceUsdc} USDC per successful paid audit</li></ul></article><article><p className="pill">Browser-rendered · minutes</p><h3>Deep</h3><p>A real isolated browser adds Lighthouse lab metrics, rendered axe-core findings, screenshots, network and console evidence, and passive security analysis.</p><ul className="check-list"><li>Versioned job, report, and artifact flow</li><li>Screenshots and rendered evidence</li><li>{"$"}{deep.priceUsdc} USDC per compute reservation</li></ul></article></div><p className="sub sub--tight">Both modes assess one page, not a whole-site crawl. Lab data is not field data, automated accessibility checks do not certify WCAG conformance, and passive security checks are not penetration testing.</p></section>

        <section className="content-section" id="use-cases"><p className="section-label">Use cases</p><h2>Built for teams making the web agent-ready</h2><div className="feature-grid five-up"><article className="feature-card"><h3>AI-agent developers</h3><p>Evaluate public interfaces before adding them to a tool registry or autonomous workflow.</p></article><article className="feature-card"><h3>Agencies</h3><p>Turn a URL into traceable technical evidence and a prioritized implementation backlog.</p></article><article className="feature-card"><h3>SaaS teams</h3><p>Check whether product docs, APIs, payment rules, and identity claims stay consistent.</p></article><article className="feature-card"><h3>Technical SEO teams</h3><p>Extend crawl and content foundations into structured meaning and machine capabilities.</p></article><article className="feature-card"><h3>Automation platforms</h3><p>Consume versioned JSON without opening accounts or distributing traditional API keys.</p></article></div></section>

        <section className="content-section" id="integration"><p className="section-label">Developer integration</p><h2>Public contracts, predictable payment, no account</h2><p className="sub wide">{PAID_CAPABILITY_COUNT} paid capabilities, metered per call in USDC on Base mainnet over the x402 protocol. No accounts, no API keys — payment settles only on a successful response, so a failed call is never charged.</p><div className="integration-grid"><a href="/openapi.json" data-analytics-event="openapi_downloaded"><strong>OpenAPI 3.1</strong><span>Typed operations, schemas, errors, and x402 behavior</span></a><a href="/mcp-readiness-checker"><strong>MCP</strong><span>Streamable HTTP discovery and paid audit handoff</span></a><a href="/.well-known/agent-capabilities.json"><strong>Capability manifest</strong><span>Selection guidance, pricing, limits, and support</span></a><a href="/llms.txt"><strong>llms.txt</strong><span>Low-noise service guide and canonical machine links</span></a><a href="/integrations"><strong>MCP server</strong><span>One endpoint, seven tools — Claude, Grok, or any MCP client</span></a></div><div className="flow"><span className="c"># Agent Readiness · synchronous</span><br />GET /api/agent-readiness?url=example.com&amp;depth=quick<br /><span className="a">← 402 · PAYMENT-REQUIRED · {readiness.priceUsdc} USDC · eip155:8453</span><br />→ retry with PAYMENT-SIGNATURE <span className="c">(any x402 v2 client can automate this)</span><br /><span className="g">← 200 · versioned evidence + PAYMENT-RESPONSE receipt</span></div><div className="cta-row"><a className="btn" href="/docs" data-analytics-event="api_docs_opened">Read the API docs</a><a className="btn" href="/pricing" data-analytics-event="pricing_api_tab_opened">See all {PAID_CAPABILITY_COUNT} API capabilities</a><a className="btn" href="/methodology/agent-readiness">Scoring methodology</a></div></section>

        <section className="content-section" id="reports" data-analytics-event="pricing_viewed"><p className="section-label">Human reports</p><h2>Prefer a formatted report by email?</h2><p className="sub wide">The API returns raw machine-readable JSON. Human reports are the same evidence, formatted, emailed as a private tokened link, and independently verifiable — purchased by card, no account.</p><div className="compare-grid"><article><p className="pill">One-time</p><h3>Quick Report — {usdLabel(quickReport.priceUsd)}</h3><p>{quickReport.summary}</p></article><article><p className="pill">One-time</p><h3>Deep Report — {usdLabel(deepReport.priceUsd)}</h3><p>{deepReport.summary}</p></article><article><p className="pill">Subscription</p><h3>Monitoring — {usdLabel(monitoring.priceUsd)}/mo</h3><p>{monitoring.summary}</p></article></div><div className="cta-row"><a className="btn primary" href="/agent-readiness/buy" data-analytics-event="human_report_selected">Get a report — from {usdLabel(quickReport.priceUsd)}</a><a className="btn" href="/monitoring" data-analytics-event="monitoring_started">Start monitoring</a></div></section>

        <section className="content-section split-section" id="about"><div><p className="section-label">About the builder</p><h2>Built and operated by one accountable engineer</h2><p className="sub wide">Santos Automation is founded and run by <strong>Juan Santos</strong>. He spent years as a hands-on field technician and in sales before teaching himself software engineering — since 2020 he has shipped more than 100 public projects, from e-commerce with live Stripe checkout to AI audit systems and automation tooling. He now runs Santos Automation full-time from Charlotte, North Carolina.</p><p className="sub wide">This API is production infrastructure, not a pitch deck: it meters real payments in USDC on Base, publishes its scoring methodology, and the same engine has audited {INDEX_STATS.auditedSiteCountLabel} of the world's best-known websites — every report HMAC-signed and independently verifiable.</p><p className="sub wide">No ticket queue, no account managers. When you contact Santos, you reach the person who wrote the code.</p><div className="inline-links" aria-label="Founder links"><a href="https://github.com/thereal-baitjet" rel="me">GitHub</a><a href="https://www.linkedin.com/in/santosjuanc/" rel="me">LinkedIn</a><a href="mailto:info@santosautomation.com">info@santosautomation.com</a></div></div><img className="about-portrait" src="/assets/santos-portrait.png" alt="Portrait of Juan Santos, founder and engineer of Santos Automation" width="1086" height="1448" loading="lazy" /></section>

        <section className="content-section" id="faq"><p className="section-label">FAQ</p><h2>Questions about AI Website Intelligence</h2><div className="faq-list">{FAQS.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>

        <section className="content-section final-cta" id="get-started"><h2>Find out what AI agents see when they visit your site.</h2><div className="cta-row"><a className="btn primary" href="#see-reports" data-analytics-event="hero_see_reports_clicked">See a Real Report</a><a className="btn" href="/pricing">View pricing</a></div></section>
      </div>
    </PageShell>
  );
}
