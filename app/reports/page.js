import { PageShell } from "../components/SiteChrome.js";
import { topPublicReports } from "../../lib/public-reports.js";

// Public leaderboard of opted-in audit reports, highest score first.
export const dynamic = "force-dynamic";

const path = "/reports";
export const metadata = {
  title: "Agent-Readiness Leaderboard | Santos",
  description: "Public Santos audit reports, ranked by agent-readiness score. Every listed site opted in; badges link back to the full signed report.",
  alternates: { canonical: path },
  openGraph: { title: "Agent-Readiness Leaderboard | Santos", description: "Public agent-readiness scores, ranked. Run a free audit to list your site.", type: "website", url: path },
};

const dateOf = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
};

const scoreClass = (score) => (score >= 80 ? "good" : score >= 60 ? "warn" : "bad");

export default async function ReportsLeaderboardPage() {
  const rows = await topPublicReports(50).catch(() => []);

  return (
    <PageShell>
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Reports</span></div>
        <header className="page-hero">
          <p className="kicker">Public reports · opt-in only</p>
          <h1>Agent-Readiness Leaderboard</h1>
          <p className="lede">Every domain below ran a Santos audit and chose to list its score publicly. Reports are signed — anyone can verify them — and each page carries an embeddable badge for your README.</p>
          <div className="cta-row"><a className="btn primary" href="/">Audit your site free</a><a className="btn" href="/verify">Verify a report</a></div>
        </header>

        <section className="content-section">
          {rows.length === 0 ? (
            <div className="callout">
              <p><strong>No public reports yet.</strong> Be the first: run the free audit on the homepage and leave “List my score publicly” checked.</p>
            </div>
          ) : (
            <div className="leaderboard-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr><th scope="col">#</th><th scope="col">Domain</th><th scope="col">Score</th><th scope="col">Audited</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.domain}>
                      <td className="rank">{i + 1}</td>
                      <td><a href={`/reports/${row.domain}`}>{row.domain}</a></td>
                      <td className={`num ${scoreClass(row.score ?? 0)}`}>{row.score ?? "—"}</td>
                      <td>{dateOf(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </article>
    </PageShell>
  );
}
