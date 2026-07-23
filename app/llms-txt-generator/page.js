import { headers } from "next/headers";
import { PageShell } from "../components/SiteChrome.js";

export const metadata = {
  title: "Free llms.txt Generator — Draft an llms.txt for Any Website | Santos",
  description:
    "Generate a draft llms.txt for any public website. One free generation per day per verified email; review the draft, then publish it at /llms.txt so agents can orient on your site.",
  alternates: { canonical: "/llms-txt-generator" },
};

// Standalone tool page (not a PRODUCT_PAGES entry): the marketing-content
// pipeline renders a fixed layout with the audit widget baked in, and this
// page needs its own widget — a standalone PageShell page is less invasive.
// Classes are all existing globals.css primitives (audit-form, audit-status,
// code-sample, content-section, btn, …).
export default async function LlmsTxtGeneratorPage() {
  // Under the nonce + strict-dynamic CSP (middleware.js), 'self' is ignored, so
  // these external scripts need the per-request nonce from the request CSP header.
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <PageShell>
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>llms.txt Generator</span></div>
        <header className="page-hero">
          <p className="kicker">Free tool · one generation per day per verified email</p>
          <h1>Draft an llms.txt for any website</h1>
          <p className="lede">
            llms.txt is a proposed orientation file that tells AI agents what your site is and where
            the useful documentation lives. Enter a public URL and Santos samples the page — title,
            description, heading outline, and internal links — and drafts a standards-shaped
            llms.txt you can review and publish.
          </p>
          <div className="cta-row">
            <a className="btn" href="/llms-txt-checker">Check an existing llms.txt</a>
            <a className="btn" href="/agent-readiness/run">Run Agent Readiness</a>
          </div>
        </header>

        <section className="content-section">
          <h2>Generate a draft</h2>
          <p className="sub">
            One free generation per day per verified email (shared with the free audit). The draft
            is a starting point from a single page sample — review it, add your docs and API links,
            then publish it at <code>/llms.txt</code>.
          </p>
          <div className="audit-box">
            <div className="audit-widget" data-llms-widget>
              <form className="audit-form" action="/v1/llms-txt/demo" method="get" data-llms-form>
                <label className="sr-only" htmlFor="llms-url">Public website URL</label>
                <input
                  id="llms-url"
                  name="url"
                  type="text"
                  placeholder="yourdomain.com"
                  autoComplete="url"
                  required
                />
                <label className="sr-only" htmlFor="llms-email">Your email</label>
                <input
                  id="llms-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <button className="btn primary" type="submit">Generate llms.txt</button>
              </form>
              <p className="audit-note">
                First use emails you a 6-digit verification code. Agents: <code>GET /v1/llms-txt/demo?url=…&amp;token=…</code>
              </p>
              <p className="audit-status" aria-live="polite" data-llms-status />
              <div className="audit-result" data-llms-result hidden>
                <pre className="code-sample" tabIndex={0} data-llms-output />
                <p>
                  <button className="btn" type="button" data-llms-copy>Copy llms.txt</button>
                </p>
                <div data-llms-notes />
                <p className="fix-cta">
                  Is the rest of your site ready for agents? <a href="/agent-readiness/run">Run the Agent Readiness audit</a> or inspect the <a href="/reports/sample-agent-readiness">sample report</a>.
                </p>
              </div>
              <script src="/verified-email.js" defer nonce={nonce} />
              <script src="/llms-txt-widget.js" defer nonce={nonce} />
            </div>
          </div>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>What the draft contains</h2>
            <p>
              A <code>#</code> site name, a <code>&gt;</code> one-line summary from your meta
              description, the page's heading outline, and up to 20 same-origin internal links
              grouped under a section — the shape proposed at llmstxt.org.
            </p>
          </div>
          <div>
            <h2>It's a draft, not the finished file</h2>
            <p>
              One page is a thin sample. Add links to your documentation, API reference, and policy
              pages; drop anything an agent doesn't need; keep it short. Then validate it with the{" "}
              <a href="/llms-txt-checker">llms.txt checker</a>.
            </p>
          </div>
        </section>

        <section className="content-section related">
          <h2>Continue evaluating</h2>
          <div className="related-links">
            <a href="/llms-txt-checker">llms.txt Checker<span aria-hidden="true"> →</span></a>
            <a href="/agent-readiness-audit">Agent Readiness Audit<span aria-hidden="true"> →</span></a>
            <a href="/methodology/agent-readiness">Scoring methodology<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
