import { AnalyticsBoot } from "./AnalyticsBoot.js";

export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      {/* Short alt keeps automated audits green; the visible "Santos
          Intelligence" text still names the link for screen readers. */}
      <a className="brand" href="/">
        <img src="/assets/santos-eagle.svg" alt="Santos Intelligence eagle emblem" width="1254" height="1254" />
        <span>Santos Intelligence</span>
      </a>
      <ul>
        <li><a href="/ai-website-intelligence">Platform</a></li>
        <li><a href="/agent-readiness-audit">Agent Readiness</a></li>
        <li><a href="/website-intelligence-api">API</a></li>
        <li><a href="/docs">Docs</a></li>
        <li><a href="/methodology/agent-readiness">Methodology</a></li>
        <li><a href="/#pricing">Pricing</a></li>
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact">
      <div className="footer-grid">
        <div>
          <h2>From discoverable to callable.</h2>
          <p className="sub">Evidence-based website intelligence for humans, developers, and AI agents.</p>
        </div>
        <div className="links" aria-label="Footer links">
          <a href="/docs">API docs</a>
          <a href="/reports">Leaderboard</a>
          <a href="/llms-txt-generator">llms.txt generator</a>
          <a href="/verify">Verify a report</a>
          <a href="/ci">CI recipe</a>
          <a href="/reports/sample-agent-readiness">Sample report</a>
          <a href="/learn/what-is-ai-website-intelligence">Learn</a>
          <a href="/openapi.json" data-analytics-event="openapi_downloaded">OpenAPI</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/status">Status</a>
          <a href="/changelog">Changelog</a>
          <a href="/terms">Terms &amp; privacy</a>
        </div>
      </div>

      <section className="footer-support" aria-labelledby="support-h">
        <h2 id="support-h">Contact &amp; support</h2>
        <p className="sub">
          Questions, integration help, or a billing issue? Email{" "}
          <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>.
        </p>
        <p className="fine">
          Payments &amp; retries: audits settle only after a successful response, so a failed
          or blocked audit is not charged. If our infrastructure fails a paid Deep audit after
          its retries, email us for a replacement run. We do not process automated on-chain
          refunds; billing questions are handled by email.
        </p>
      </section>

      <p className="fine">Santos Website Intelligence · x402 payments settle in USDC on Base</p>
      <AnalyticsBoot />
    </footer>
  );
}

export function PageShell({ children }) {
  return (
    <div className="wrap">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
