export function SiteNav() {
  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <a className="brand" href="/" aria-label="Santos Website Intelligence home">
        <img src="/assets/santos-eagle.svg" alt="Santos gold eagle emblem" width="1254" height="1254" />
        <span>Santos Intelligence</span>
      </a>
      <ul>
        <li><a href="/ai-website-intelligence">Platform</a></li>
        <li><a href="/agent-readiness-audit">Agent Readiness</a></li>
        <li><a href="/website-intelligence-api">API</a></li>
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
          <a href="/reports/sample-agent-readiness">Sample report</a>
          <a href="/learn/what-is-ai-website-intelligence">Learn</a>
          <a href="/openapi.json">OpenAPI</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/terms">Terms &amp; privacy</a>
          <a href="mailto:baitjet@gmail.com">Support</a>
        </div>
      </div>
      <p className="fine">Santos Website Intelligence · x402 payments settle in USDC on Base</p>
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
