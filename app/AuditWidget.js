export default function AuditWidget() {
  return (
    <div className="audit-widget" data-audit-widget>
      <form className="audit-form" action="/api/audit/demo" method="get" data-audit-form>
        <label className="sr-only" htmlFor="audit-url">Public website URL</label>
        <input
          id="audit-url"
          name="url"
          type="text"
          placeholder="yourdomain.com"
          aria-describedby="audit-note"
          autoComplete="url"
          required
        />
        <button className="btn primary" type="submit" data-analytics-event="quick_audit_started">Run Quick Intelligence Audit</button>
      </form>
      <p className="audit-note" id="audit-note">
        Agents: <code>GET /api/audit?url=…</code> · 0.005 USDC via x402 · no account or API key
      </p>
      <p className="audit-status" aria-live="polite" data-audit-status />
      <div className="audit-result" data-audit-result hidden>
        <div className="score-row" data-score-row />
        <div className="dimension-results" aria-label="Website Intelligence dimensions" data-dimensions hidden />
        <div data-issues />
        <p className="fix-cta">Want the complete machine-interface assessment? <a href="/agent-readiness-audit">Run Agent Readiness</a> or inspect the <a href="/reports/sample-agent-readiness">sample report</a>.</p>
      </div>
      <script src="/audit-widget.js" defer />
    </div>
  );
}
