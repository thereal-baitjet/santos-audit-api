import { buildExecutiveSummary } from "../../lib/growth/executive-summary.js";
import { isReliableAudit, normalizeAuditPayload } from "../../lib/growth/payload.js";

// Business-impact summary shared by the public and private report pages.
// Accepts any stored report shape; renders nothing when the report carries no
// Agent Readiness findings (very old Quick reports) or when the audit hit an
// error page instead of the site (bot wall, rate limit), since claims made
// from that page would describe the error, not the business.

// Labels may carry `rule-id` spans (axe rules); render those as <code>.
function withCode(text) {
  return String(text).split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

function Items({ items }) {
  return (
    <ul className="issue-list">
      {items.map((item, i) => (
        <li key={i}><strong>{withCode(item.label)}.</strong> {item.impact}</li>
      ))}
    </ul>
  );
}

export function ExecutiveSummary({ report, className = "content-section", headingId = "exec-summary-h" }) {
  const payload = isReliableAudit(report) ? normalizeAuditPayload(report) : null;
  if (!payload) return null;
  const summary = buildExecutiveSummary(payload);
  return (
    <section className={className} aria-labelledby={headingId}>
      <h2 id={headingId}>What this costs you</h2>
      <p className="lede">{summary.verdict}</p>
      {summary.exposures.length ? (<><h3>Critical exposures</h3><Items items={summary.exposures} /></>) : null}
      {summary.friction.length ? (<><h3>Operational friction</h3><Items items={summary.friction} /></>) : null}
    </section>
  );
}
