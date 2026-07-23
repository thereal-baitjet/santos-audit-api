import { PageShell } from "../../components/SiteChrome.js";
import { getPublicReport } from "../../../lib/public-reports.js";

// Public, opt-in audit report. One page per listed domain; the latest audit
// wins. Unknown domains get a friendly "not audited yet" page (still 200) —
// these URLs get pasted into READMEs before the first audit runs.
export const dynamic = "force-dynamic";

const SOURCE_LABELS = {
  "free-verified": "Free verified audit",
  "quick-paid": "Quick Intelligence Audit",
  "agent-readiness-paid": "Agent Readiness Audit",
};

const badgeSnippet = (domain) =>
  `[![Agent-Ready badge](https://api.santosautomation.com/v1/badge?url=${domain})](https://www.santosautomation.com/reports/${domain})`;

const scoreClass = (score) => (score >= 80 ? "good" : score >= 60 ? "warn" : "bad");

const dateOf = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

function scoreOf(report, fallback) {
  const score = report?.website_intelligence_score ?? report?.overall_score ?? report?.score ?? fallback;
  return Number.isFinite(score) ? score : null;
}

function dimensionsOf(report) {
  const dims = report?.website_intelligence?.dimensions ?? report?.scores ?? null;
  if (!dims || typeof dims !== "object") return [];
  return Object.entries(dims).filter(([, v]) => Number.isFinite(v));
}

const titleCase = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function generateMetadata({ params }) {
  const { domain } = await params;
  const row = await getPublicReport(domain).catch(() => null);
  const path = `/reports/${domain}`;
  if (!row) {
    return {
      title: `${domain} — not audited yet | Santos`,
      description: `${domain} has no public Santos agent-readiness report yet. Run a free audit to list it.`,
      alternates: { canonical: path },
    };
  }
  const score = scoreOf(row.report, row.score);
  const date = dateOf(row.created_at);
  return {
    title: `${domain} — Agent-Readiness Score | Santos`,
    description: `${domain} scores ${score ?? "—"}/100 on agent-readiness${date ? ` (audited ${date})` : ""}. Dimension scores, issues, fixes, and the embeddable Agent-Ready badge.`,
    alternates: { canonical: path },
    openGraph: { title: `${domain} — Agent-Readiness Score | Santos`, description: `Agent-readiness score ${score ?? "—"}/100 for ${domain}, verified by Santos Website Intelligence.`, type: "article", url: path },
  };
}

function NotAuditedYet({ domain }) {
  return (
    <PageShell>
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/reports">Reports</a><span aria-hidden="true">/</span><span>{domain}</span></div>
        <header className="page-hero">
          <p className="kicker">Public report · not listed</p>
          <h1>{domain} hasn’t been audited yet</h1>
          <p className="lede">There’s no public agent-readiness report for <strong>{domain}</strong>. Reports appear here when someone runs a Santos audit and opts in to the public listing.</p>
          <div className="cta-row"><a className="btn primary" href="/">Run a free audit</a><a className="btn" href="/reports">Browse the leaderboard</a></div>
        </header>
      </article>
    </PageShell>
  );
}

export default async function PublicReportPage({ params }) {
  const { domain } = await params;
  const row = await getPublicReport(domain).catch(() => null);
  if (!row) return <NotAuditedYet domain={domain} />;

  const report = row.report ?? {};
  const score = scoreOf(report, row.score);
  const audited = dateOf(row.created_at);
  const dimensions = dimensionsOf(report);
  const issues = Array.isArray(report.issues) ? report.issues.filter((i) => typeof i === "string") : [];
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const actions = Array.isArray(report.recommended_actions) ? report.recommended_actions : [];
  const grade = report.grade ?? null;
  const readinessLevel = report.readiness_level?.name ?? null;
  const snippet = badgeSnippet(row.domain);

  return (
    <PageShell>
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/reports">Reports</a><span aria-hidden="true">/</span><span>{row.domain}</span></div>
        <header className="page-hero">
          <p className="kicker">Public report · {SOURCE_LABELS[row.source] ?? "Santos audit"}</p>
          <h1>{row.domain}</h1>
          <p className="lede">
            Agent-readiness score <strong>{score ?? "—"}/100</strong>
            {grade ? <> · grade <strong>{grade}</strong></> : null}
            {readinessLevel ? <> · {readinessLevel}</> : null}
            {audited ? <> · audited {audited}</> : null}
          </p>
          <div className="cta-row"><a className="btn primary" href="/">Re-audit this site</a><a className="btn" href="/verify">Verify this report</a></div>
        </header>

        <section className="content-section">
          <h2>Scores</h2>
          <div className="score-row sample-scores">
            <div className="score-card"><div className={`num ${scoreClass(score ?? 0)}`}>{score ?? "—"}</div><div className="lbl">Agent-Ready</div></div>
            {dimensions.map(([key, value]) => (
              <div className="score-card" key={key}><div className={`num ${scoreClass(value)}`}>{value}</div><div className="lbl">{titleCase(key)}</div></div>
            ))}
          </div>
          {report.signature ? <p className="sub sub--tight">This report is cryptographically signed (<code>{report.signature_alg}</code>, signed {dateOf(report.signed_at) ?? "—"}). Paste the JSON into the <a href="/verify">verifier</a> to confirm it’s unmodified.</p> : null}
        </section>

        {issues.length ? (
          <section className="content-section">
            <h2>Issues &amp; fixes</h2>
            <ul className="issue-list">
              {issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
          </section>
        ) : null}

        {findings.length ? (
          <section className="content-section">
            <h2>Findings</h2>
            <div className="finding-list">
              {findings.map((finding, i) => (
                <article className={`finding ${finding.status === "pass" ? "pass" : finding.status === "fail" ? "fail" : "warning"}`} key={finding.id ?? i}>
                  <span>{finding.status === "pass" ? "Passed" : finding.status === "fail" ? (finding.severity ?? "Failed") : "Warning"}</span>
                  <h3>{finding.title ?? finding.id ?? "Finding"}</h3>
                  {finding.recommendation && finding.recommendation !== "No action needed." ? <p>{finding.recommendation}</p> : null}
                </article>
              ))}
            </div>
            {actions.length ? (
              <div className="callout">
                <p><strong>Prioritized fixes:</strong> {actions.slice(0, 5).map((a) => a.id ?? a).join(" · ")}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="content-section">
          <h2>Embed the badge</h2>
          <p className="sub wide">Show the live score in your README. The badge updates on every re-audit and greys out when the report is older than 30 days.</p>
          <p><img src={`/v1/badge?url=${encodeURIComponent(row.domain)}`} alt={`Agent-Ready badge for ${row.domain}`} width="260" height="28" /></p>
          <pre className="code-sample" tabIndex={0}><code>{snippet}</code></pre>
        </section>
      </article>
    </PageShell>
  );
}
