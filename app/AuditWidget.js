import { headers } from "next/headers";

export default async function AuditWidget() {
  // Under the nonce + strict-dynamic CSP (middleware.js), 'self' is ignored, so
  // this external script needs the per-request nonce to load. Read it from the
  // request CSP header that middleware set.
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <div className="audit-widget" data-audit-widget>
      <form
        className="audit-form"
        action="/api/audit/demo"
        method="get"
        data-audit-form
        toolname="quickAuditForm"
        tooldescription="Run a free website intelligence audit of a public URL and see its AI Website Intelligence score, dimension scores, and top issues. Limited to one free scan per day; read-only."
        toolautosubmit=""
      >
        <label className="sr-only" htmlFor="audit-url">Public website URL</label>
        <input
          id="audit-url"
          name="url"
          type="text"
          placeholder="yourdomain.com"
          aria-describedby="audit-note"
          autoComplete="url"
          toolparamdescription="Public website URL to audit, e.g. https://example.com or example.com"
          required
        />
        <button className="btn primary" type="submit" data-analytics-event="quick_audit_started">Run Quick Intelligence Audit</button>
      </form>
      <p className="audit-note" id="audit-note">
        Agents: <code>GET /api/audit?url=…</code> · 0.015 USDC via x402 · no account or API key
      </p>
      <p className="audit-status" aria-live="polite" data-audit-status />
      <div className="audit-result" data-audit-result hidden>
        <div className="score-row" data-score-row />
        <div className="dimension-results" aria-label="Website Intelligence dimensions" data-dimensions hidden />
        <div data-issues />
        <p className="fix-cta">Want the complete machine-interface assessment? <a href="/agent-readiness-audit">Run Agent Readiness</a> or inspect the <a href="/reports/sample-agent-readiness">sample report</a>.</p>
      </div>
      <script src="/audit-widget.js" defer nonce={nonce} />
    </div>
  );
}
