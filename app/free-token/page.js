import { headers } from "next/headers";
import { PageShell } from "../components/SiteChrome.js";

const API = "https://api.santosautomation.com";
const SITE = "https://www.santosautomation.com";

export const metadata = {
  title: "Free-tier token — your own daily quota | Santos",
  description:
    "Get a verified-email token so the free Santos MCP tools count against you, not the shared IP quota your agent platform uses.",
  alternates: { canonical: "/free-token" },
};

// Shown before a token exists; the script rewrites <token> in place once issued.
const CLAUDE_EXAMPLE = '{"url": "https://example.com", "token": "<token>"}';
const CURL_EXAMPLE = `curl -X POST ${API}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"audit_website_preview","arguments":{"url":"https://example.com","token":"<token>"}}}'`;

export default async function FreeTokenPage() {
  // Under the nonce + strict-dynamic CSP, 'self' is ignored, so these scripts
  // need the per-request nonce set by proxy.js.
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];

  return (
    <PageShell>
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a><span aria-hidden="true">/</span>
          <span>Free-tier token</span>
        </div>

        <header className="page-hero">
          <p className="kicker">Free tier · one call per day · no card</p>
          <h1>Get your own free-tier quota</h1>
          <p className="lede">
            The free Santos tools allow one call per day per identity. Without a token that
            identity is the calling IP — and Claude, Grok, and every other hosted agent reach the
            API from shared infrastructure, so that single call is spent by whoever gets there
            first. A token moves the quota onto you.
          </p>
        </header>

        <section className="content-section">
          <h2>Issue a token</h2>
          <p className="sub wide">
            One 6-digit code by email. The token is valid 30 days, carries one free call per day,
            and needs no account or card.
          </p>

          <div className="audit-widget" data-token-widget>
            <form className="audit-form" data-token-form>
              <label className="sr-only" htmlFor="token-email">Email address</label>
              <input
                id="token-email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                data-token-email
              />
              <button className="btn" type="submit">Email me a code</button>
            </form>
            <p className="sub" data-token-status aria-live="polite" />

            <div className="audit-result" data-token-result hidden>
              <h3>Your token</h3>
              <pre className="code-sample" tabIndex={0}><code data-token-value /></pre>
              <p>
                <button className="btn" type="button" data-token-copy>Copy token</button>
              </p>
              <p className="sub">
                Store it like a password. Anyone holding it spends your daily call.
              </p>

              <h3>Paste it into a tool call</h3>
              <p className="sub">
                Every free tool — <code>audit_website_preview</code>,{" "}
                <code>extract_page_markdown</code>, <code>extract_structured_data</code> — accepts
                an optional <code>token</code> argument:
              </p>
              <pre className="code-sample" tabIndex={0}><code data-token-example={CLAUDE_EXAMPLE}>{CLAUDE_EXAMPLE}</code></pre>
              <p className="sub">Or straight over HTTP:</p>
              <pre className="code-sample" tabIndex={0}><code data-token-example={CURL_EXAMPLE}>{CURL_EXAMPLE}</code></pre>
            </div>
          </div>

          <script src="/verified-email.js" defer nonce={nonce} />
          <script src="/free-token.js" defer nonce={nonce} />
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>Why the IP quota runs out</h2>
            <p>
              A hosted agent does not call from your machine — it calls from its provider&rsquo;s
              servers. Every user of that platform shares those addresses, so they share one daily
              free call. Raising the limit would not fix it; the identity is the problem, which is
              why the token exists.
            </p>
          </div>
          <div>
            <h2>When you outgrow free</h2>
            <p>
              One call a day is for evaluation. Paid endpoints have no quota at all — they settle
              per call in USDC on Base over x402, with no account and no API key, and a failed call
              is never charged. See <a href="/docs">the docs</a> or{" "}
              <a href="/agent-readiness/buy">buy a formatted report</a> if you would rather not run
              a wallet.
            </p>
          </div>
        </section>

        <section className="content-section related">
          <h2>Continue</h2>
          <div className="related-links">
            <a href="/integrations/claude">Claude connector setup<span aria-hidden="true"> →</span></a>
            <a href="/integrations/grok">Grok setup<span aria-hidden="true"> →</span></a>
            <a href="/docs">API documentation<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
