import AuditWidget from "./AuditWidget";
import { getAgentReadinessPriceUsdc } from "../lib/agent-readiness/product-pricing.js";

const agentReadinessPrice = getAgentReadinessPriceUsdc();

export default function Home() {
  return (
    <div className="wrap">
      <nav>
        <span className="brand">
          <img
            src="/assets/santos-logo.png"
            alt="Gold mountain mark for Santos Automation"
            width="1024"
            height="1024"
          />
          Santos Automation
        </span>
        <ul>
          <li><a href="#audit">Audit</a></li>
          <li><a href="#plans">Plans</a></li>
          <li><a href="#agents">For Agents</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <div className="kicker">Automate · Build · Elevate</div>
          <h1>Software for people.<br />APIs that machines pay for.</h1>
          <p className="lede">
            Custom web apps and automation systems — plus something new: machine-payable
            APIs built on the x402 protocol, where AI agents are the customers and every
            call settles in USDC.
          </p>
          <div className="cta-row">
            <a className="btn primary" href="#audit">Run a free site audit</a>
            <a className="btn" href="#plans">See the plans</a>
          </div>
        </div>
        <img
          className="hero-eagle"
          src="/assets/santos-eagle.svg"
          alt="Gold geometric eagle, the Santos Automation emblem"
          width="1254"
          height="1254"
          fetchPriority="high"
        />
      </header>

      <section className="audit" id="audit">
        <h2>Audit your site in seconds.</h2>
        <p className="sub">
          Performance, SEO, accessibility, and security — scored live, no signup.
          One free audit per day; unlimited for paying agents.
        </p>
        <div className="audit-box">
          <AuditWidget />
        </div>
      </section>

      <section className="plans" id="plans">
        <h2>Three audit modes. One honest scope for each.</h2>
        <p className="sub">
          No accounts, no API keys, no subscriptions. Every audit is a single x402
          micropayment in USDC on Base — humans get the free daily demo above.
        </p>
        <div className="plan-grid">
          <div className="plan">
            <div className="plan-head">
              <h3>Quick Audit</h3>
              <div className="plan-price">$0.005 <span>USDC / audit</span></div>
              <div className="plan-mode">synchronous · results in seconds</div>
            </div>
            <p className="plan-pitch">
              A fast, lightweight read of any public page. Perfect for lead
              qualification, deploy sanity checks, and monitoring sweeps at scale.
            </p>
            <ul className="plan-list">
              <li>Fetch-timing &amp; page-weight performance signals</li>
              <li>SEO signals: title, meta, headings, canonical, OpenGraph</li>
              <li>Basic HTML accessibility signals (alt text, lang, viewport)</li>
              <li>Security-header checks (HTTPS, HSTS, CSP)</li>
              <li>0–100 category scores + plain-English fixes</li>
            </ul>
            <div className="plan-endpoint"><code>GET /api/audit?url=…</code></div>
          </div>

          <div className="plan plan--agent">
            <div className="plan-head">
              <h3>Agent Readiness</h3>
              <div className="plan-price">${agentReadinessPrice} <span>USDC / successful audit</span></div>
              <div className="plan-mode">synchronous · bounded passive discovery</div>
            </div>
            <p className="plan-pitch">
              See whether agents can discover, understand, invoke, and—only where
              applicable—pay for a site or service without guesswork.
            </p>
            <ul className="plan-list">
              <li>llms.txt and machine-interface discovery</li>
              <li>Structured identity and Schema.org WebAPI signals</li>
              <li>OpenAPI operations, schemas, and access documentation</li>
              <li>MCP transport, tool schema, output, and safety metadata</li>
              <li>Operational trust and optional x402 challenge quality</li>
              <li>Applicability-aware scoring for ordinary websites</li>
            </ul>
            <div className="plan-endpoint"><code>GET /api/agent-readiness?url=…</code></div>
          </div>

          <div className="plan plan--deep">
            <div className="plan-head">
              <h3>Deep Page Audit</h3>
              <div className="plan-price">$0.075 <span>USDC / audit</span></div>
              <div className="plan-mode">async job · typically 30s–2min</div>
            </div>
            <p className="plan-pitch">
              A real browser renders the page in an isolated worker and comes back
              with evidence — the professional-grade report you&rsquo;d hand a client.
            </p>
            <ul className="plan-list">
              <li>Google Lighthouse lab metrics: LCP, CLS, TBT, Speed Index</li>
              <li>Rendered axe-core accessibility findings, with CSS selectors</li>
              <li>Viewport + full-page screenshots (signed download links)</li>
              <li>Browser network &amp; console evidence, third-party inventory</li>
              <li>Passive security analysis: CSP quality, cookie flags, mixed content</li>
              <li>Versioned JSON report with per-finding evidence &amp; severity</li>
            </ul>
            <div className="plan-endpoint"><code>POST /v1/audits</code> → poll → report</div>
          </div>
        </div>
        <p className="sub sub--tight plan-fineprint">
          Both audit a single page — honest scope, no crawler theater. Deep audits
          are lab measurements, not field data; automated accessibility checks
          don&rsquo;t certify WCAG conformance. Full contracts in the{" "}
          <a href="/openapi.json">OpenAPI spec</a>.
        </p>
      </section>

      <section className="agents" id="agents">
        <h2>Built for the agent economy.</h2>
        <p className="sub">
          Both tiers speak x402 — the Linux Foundation payment standard that lets
          AI agents pay per-request in stablecoins. Your agent hits the endpoint,
          pays, and gets the report or a job it can poll. Settled on-chain.
        </p>
        <div className="flow">
          <span className="c"># quick audit — synchronous:</span><br />
          GET /api/audit?url=example.com<br />
          <span className="a">← 402 · PAYMENT-REQUIRED · $0.005 USDC · eip155:8453</span><br />
          → retry + PAYMENT-SIGNATURE <span className="c">(signed automatically)</span><br />
          <span className="g">← 200 OK · full audit report + on-chain receipt</span><br />
          <br />
          <span className="c"># deep audit — browser-rendered job:</span><br />
          POST /v1/audits {"{"}&quot;url&quot;: &quot;example.com&quot;{"}"}<br />
          <span className="a">← 402 · PAYMENT-REQUIRED · $0.075 USDC</span><br />
          → retry + PAYMENT-SIGNATURE + Idempotency-Key<br />
          <span className="g">← 201 · job_id + access_token</span> <span className="c">→ poll status_url</span><br />
          <span className="g">← report: Lighthouse + axe-core + screenshots + evidence</span>
        </div>
        <p className="sub sub--tight">
          Want an API like this for your business? That&rsquo;s the newest thing I build —
          see <a href="/llms.txt">llms.txt</a> for the machine-readable guide. Agents
          can also discover the <a href="/openapi.json">OpenAPI contract</a>,{" "}
          <a href="/capabilities.json">capability manifest</a>, and{" "}
          <a href="https://api.santosautomation.com/mcp">MCP endpoint</a>.
        </p>
      </section>

      <section className="services" id="services">
        <h2>What I build.</h2>
        <div className="svc-list">
          <div className="svc">
            <h3>Machine-payable APIs</h3>
            <p>x402-monetized endpoints that sell your data or tools to AI agents per-call. From idea to revenue-generating endpoint.</p>
          </div>
          <div className="svc">
            <h3>Custom web apps</h3>
            <p>Modern product interfaces, admin tools, and client portals. Direct, fast, maintainable.</p>
          </div>
          <div className="svc">
            <h3>Automation systems</h3>
            <p>Lead routing, follow-ups, reminders, forms, and reports. Repeatable tasks handled without drama.</p>
          </div>
          <div className="svc">
            <h3>APIs &amp; integrations</h3>
            <p>Connect the tools already running the business — email, calendar, CRM, payments.</p>
          </div>
        </div>
      </section>

      <footer id="contact">
        <h2>Reach Santos from one place.</h2>
        <div className="links">
          <a href="mailto:baitjet@gmail.com">baitjet@gmail.com</a>
          <a href="https://instagram.com/mr.j.c.santos">@mr.j.c.santos</a>
          <a href="https://github.com/thereal-baitjet">GitHub</a>
          <a href="https://cal.com/santosautomation">Book a call</a>
          <a href="/terms">Terms &amp; privacy</a>
        </div>
        <p className="fine">santosautomation.com · audit API powered by x402 · payments settle in USDC on Base</p>
      </footer>
    </div>
  );
}
