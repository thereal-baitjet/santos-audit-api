// Accessible product-proof preview of a Santos report, rendered from the same
// sanitized sample data as /reports/sample-agent-readiness. Always labeled as
// sample data — it demonstrates report structure, not a customer result.
const SAMPLE = {
  score: 82,
  dimensions: [
    { name: "Discoverable", value: 91, tone: "good" },
    { name: "Understandable", value: 78, tone: "warn" },
    { name: "Callable", value: 73, tone: "warn" },
    { name: "Trustworthy", value: 86, tone: "good" },
  ],
  coverage: "36 of 40 checks executed · 3 not applicable · 1 skipped · 90% weighted evidence coverage · confidence 0.91",
  evidence: {
    status: "Failed — high priority",
    title: "Machine-readable capability description was incomplete",
    detail: "The API was described, but no separate manifest summarized selection guidance, resource-scoped pricing, rate limits, and side effects.",
  },
  fixes: [
    { impact: "high", effort: "medium", text: "Publish a versioned capability manifest naming each callable resource, endpoint, schemas, billing unit, price, errors, and support. Link it from HTML or an HTTP Link header." },
    { impact: "medium", effort: "low", text: "Confirm the advertised MCP endpoint in a public registry record, or remove the claim until registry evidence exists." },
    { impact: "medium", effort: "medium", text: "Add typed error responses with stable machine-readable codes to the OpenAPI document so agents can retry predictably." },
  ],
};

export default function ReportPreview() {
  return (
    <section className="content-section" id="sample-preview" aria-labelledby="sample-preview-h">
      <p className="section-label">Sample data · sanitized report preview</p>
      <h2 id="sample-preview-h">What a Santos report looks like</h2>
      <p className="sub wide">
        Every audit returns a 0–100 AI Website Intelligence score across four dimensions, the evidence behind
        each finding, and fixes ranked by impact. This preview uses sanitized sample data — illustrative
        structure, not a customer result, testimonial, or certification.
      </p>
      <div className="score-row sample-scores" role="group" aria-label={`Sample AI Website Intelligence score ${SAMPLE.score} out of 100`}>
        <div className="score-card"><div className="num good">{SAMPLE.score}</div><div className="lbl">Website Intelligence</div></div>
        {SAMPLE.dimensions.map((dimension) => (
          <div className="score-card" key={dimension.name}>
            <div className={`num ${dimension.tone}`}>{dimension.value}</div>
            <div className="lbl">{dimension.name}</div>
          </div>
        ))}
      </div>
      <p className="sub sub--tight">{SAMPLE.coverage}. Scores are numeric labels, never color alone.</p>
      <div className="report-preview-grid">
        <article className="finding fail">
          <span>{SAMPLE.evidence.status}</span>
          <h3>{SAMPLE.evidence.title}</h3>
          <p>{SAMPLE.evidence.detail}</p>
        </article>
        <div className="fix-list">
          <h3>Top prioritized fixes</h3>
          <ol>
            {SAMPLE.fixes.map((fix) => (
              <li key={fix.text}><strong>Impact {fix.impact}</strong> · effort {fix.effort} — {fix.text}</li>
            ))}
          </ol>
        </div>
      </div>
      <p className="sub sub--tight">
        Quick audits are fetch-based; Deep audits render your page in a real browser. Automated accessibility
        checks do not certify WCAG conformance, and passive security checks are not penetration testing.
      </p>
      <div className="cta-row">
        <a className="btn" href="/reports/sample-agent-readiness" data-analytics-event="sample_report_opened">Open the full sample report</a>
        <a className="btn" href="/verify">Verify a report signature</a>
      </div>
    </section>
  );
}
