import { PageShell } from "../components/SiteChrome.js";
import { topPublicReports } from "../../lib/public-reports.js";

// Public leaderboard of opted-in audit reports, highest score first.
export const dynamic = "force-dynamic";

const path = "/reports";
export const metadata = {
  title: "The web isn't agent-ready — yet. | Santos Leaderboard",
  description: "200+ public agent-readiness reports, ranked by score. Average 59/100 — see where the world's biggest sites fail, and where yours stands.",
  alternates: { canonical: path },
  openGraph: { title: "The web isn't agent-ready — yet. | Santos Leaderboard", description: "200+ public agent-readiness scores, ranked. Average 59/100. Run a free audit to list your site.", type: "website", url: path },
};

const dateOf = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
};

const scoreClass = (score) => (score >= 80 ? "good" : score >= 60 ? "warn" : "bad");

export default async function ReportsLeaderboardPage() {
  const rows = await topPublicReports(200).catch(() => []);

  const scored = rows.map((r) => r.score).filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  const median = scored.length ? scored[Math.floor(scored.length / 2)] : null;

  return (
    <PageShell>
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Reports</span></div>
        <header className="page-hero">
          <p className="kicker">Public reports · opt-in only</p>
          <h1>The web isn't agent-ready — yet.</h1>
          <p className="lede">Every domain below ran a Santos audit and chose to list its score publicly. Reports are signed — anyone can verify them — and each page carries an embeddable badge for your README.</p>
          {average != null && (
            <div className="stat-strip">
              <div className="wrap">
                <div className="stat"><b>{scored.length}</b><span>public reports</span></div>
                <div className="stat"><b>{average}</b><span>average score</span></div>
                <div className="stat"><b>{median}</b><span>median score</span></div>
                <div className="stat"><b>{scored[scored.length - 1]}</b><span>highest score</span></div>
              </div>
            </div>
          )}
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
