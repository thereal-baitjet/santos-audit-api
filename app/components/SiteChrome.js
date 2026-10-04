import Image from "./CspImage.js";
import { ArrowUpRight } from "lucide-react";
import { AnalyticsBoot } from "./AnalyticsBoot.js";
import Navigation from "./Navigation.js";

export function SiteNav() {
  return <Navigation />;
}

const footerGroups = [
  {
    title: "Platform",
    links: [
      ["Website intelligence", "/ai-website-intelligence"],
      ["Agent readiness", "/agent-readiness-audit"],
      ["Public reports", "/reports"],
      ["Get a report", "/agent-readiness/buy"],
      ["Monitoring", "/monitoring"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["API documentation", "/docs"],
      ["MCP integrations", "/integrations"],
      ["OpenAPI specification", "/openapi.json"],
      ["llms.txt", "/llms.txt"],
      ["CI recipe", "/ci"],
      ["GitHub", "https://github.com/thereal-baitjet/santos-audit-api"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Methodology", "/methodology/agent-readiness"],
      ["Sample report", "/reports/sample-agent-readiness"],
      ["Verify a report", "/verify"],
      ["Learning center", "/learn/what-is-ai-website-intelligence"],
      ["Changelog", "/changelog"],
      ["Service status", "/status"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="chrome-footer" id="contact">
      <div className="chrome-footer-main">
        <div className="chrome-footer-about">
          <a className="chrome-brand" href="/">
            <Image
              src="/assets/santos-eagle.svg"
              alt=""
              width={36}
              height={36}
            />
            <span>
              SANTOS<span className="chrome-brand-sub">INTELLIGENCE</span>
            </span>
          </a>
          <p>
            A clearer picture of your place
            <br />
            in the agentic web.
          </p>
          <a
            className="chrome-email"
            href="mailto:info@santosautomation.com"
            data-analytics-event="contact_clicked"
          >
            Talk to the builder <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
        {footerGroups.map((group) => (
          <div className="chrome-footer-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="chrome-footer-bottom">
        <span>© {new Date().getFullYear()} Santos Automation</span>
        <span className="chrome-footer-location">
          Independently built in Charlotte, NC.
        </span>
        <div>
          <a href="/terms">Terms &amp; privacy</a>
          <button type="button" data-cookie-settings>
            Cookie settings
          </button>
        </div>
      </div>
      <AnalyticsBoot />
    </footer>
  );
}

export function PageShell({ children, className = "" }) {
  return (
    <div className={`wrap site-shell ${className}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteNav />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
