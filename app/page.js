import AuditWidget from "./AuditWidget";

export default function Home() {
  return (
    <div className="wrap">
      <nav>
        <span className="brand">
          <img src="/assets/santos-logo.png" alt="Santos Automation logo" />
          Santos Automation
        </span>
        <ul>
          <li><a href="#audit">Audit</a></li>
          <li><a href="#agents">For Agents</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <header className="hero">
        <div className="kicker">Automate · Build · Elevate</div>
        <h1>Software for people.<br />APIs that machines pay for.</h1>
        <p className="lede">
          Custom web apps and automation systems — plus something new: machine-payable
          APIs built on the x402 protocol, where AI agents are the customers and every
          call settles in USDC.
        </p>
        <div className="cta-row">
          <a className="btn primary" href="#audit">Run a free site audit</a>
          <a className="btn" href="#contact">Work with me</a>
        </div>
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

      <section className="agents" id="agents">
        <h2>Built for the agent economy.</h2>
        <p className="sub">
          This site&rsquo;s audit API speaks x402 — the Linux Foundation payment standard that lets
          AI agents pay per-request in stablecoins. No accounts, no API keys, no subscriptions.
          Your agent hits the endpoint, pays half a cent, gets the report. Two seconds, settled on-chain.
        </p>
        <div className="flow">
          <span className="c"># any x402-capable agent:</span><br />
          GET /api/audit?url=example.com<br />
          <span className="a">← 402 Payment Required · $0.005 USDC · base</span><br />
          → retry + X-PAYMENT <span className="c">(signed automatically)</span><br />
          <span className="g">← 200 OK · full audit report + on-chain receipt</span>
        </div>
        <p className="sub sub--tight">
          Want an API like this for your business? That&rsquo;s the newest thing I build —
          see <a href="/llms.txt">llms.txt</a> for the machine-readable spec.
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
        </div>
        <p className="fine">santosautomation.com · audit API powered by x402 · payments settle in USDC on Base</p>
      </footer>
    </div>
  );
}
