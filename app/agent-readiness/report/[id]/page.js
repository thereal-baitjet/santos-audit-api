// Human-readable report page for a Stripe-purchased Agent Readiness Report.
// Authorization reuses the deep tier's HMAC bearer-token mechanism
// (verifyAccessToken) via a ?token= query param from the emailed link.
import { PageShell } from "../../../components/SiteChrome.js";
import { verifyAccessToken } from "../../../../lib/deep/ids.js";
import { getReportById } from "../../../../lib/stripe/store.js";

export const metadata = {
  title: "Your Agent Readiness Report | Santos Website Intelligence",
  // Private, tokened content — must never be indexed.
  robots: { index: false, follow: false, nocache: true },
};

const pct = (n) => (typeof n === "number" ? `${Math.round(n)}` : "—");

export default async function ReportPage({ params, searchParams }) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!verifyAccessToken(id, token)) {
    return (
      <PageShell>
        <article className="content-page ar-page">
          <h1>This report link isn't valid</h1>
          <p className="lede">The link may be mistyped or incomplete. Use the exact link from your email, or contact <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.</p>
        </article>
      </PageShell>
    );
  }

  const row = await getReportById(id);
  if (!row || !row.report) {
    return (
      <PageShell>
        <article className="content-page ar-page">
          <h1>Your report is still being generated</h1>
          <p className="lede">Reports are usually ready within a few minutes of purchase. Refresh this page shortly. If it's been more than 15 minutes, email <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.</p>
        </article>
      </PageShell>
    );
  }

  const r = row.report;
  const wi = r.website_intelligence;
  const sub = r.subscores ?? {};
  const actions = r.recommended_actions ?? [];

  return (
    <PageShell>
      <article className="content-page ar-page report-view">
        <header>
          <p className="kicker">Agent Readiness Report</p>
          <h1>{r.target?.final_url ?? row.target_url}</h1>
          <p className="lede">
            Readiness level: <strong>{r.readiness_level ?? "—"}</strong>
            {r.grade ? <> · Grade <strong>{r.grade}</strong></> : null}
            {typeof r.score === "number" ? <> · Score <strong>{pct(r.score)}/100</strong></> : null}
          </p>
        </header>

        {wi?.dimensions && (
          <section className="ar-section" aria-labelledby="dims-h">
            <h2 id="dims-h">Website Intelligence dimensions</h2>
            <div className="score-row">
              {Object.entries(wi.dimensions).map(([k, v]) => (
                <div className="score-card" key={k}>
                  <div className="num">{v == null ? "n/a" : pct(v)}</div>
                  <div className="lbl">{k}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {Object.keys(sub).length > 0 && (
          <section className="ar-section" aria-labelledby="sub-h">
            <h2 id="sub-h">Category subscores</h2>
            <dl className="ar-dl">
              {Object.entries(sub).map(([k, v]) => (
                <div key={k}><dt>{k.replace(/_/g, " ")}</dt><dd>{v == null ? "not applicable" : `${pct(v)}/100`}</dd></div>
              ))}
            </dl>
          </section>
        )}

        {actions.length > 0 && (
          <section className="ar-section" aria-labelledby="fix-h">
            <h2 id="fix-h">Prioritized fixes</h2>
            <ol className="fix-list">
              {actions.slice(0, 12).map((a, i) => (
                <li key={i}>
                  <strong>{a.severity ? `[${a.severity}] ` : ""}</strong>
                  {a.recommendation ?? a.title ?? JSON.stringify(a)}
                </li>
              ))}
            </ol>
          </section>
        )}

        {r.limitations?.length > 0 && (
          <section className="ar-section" aria-labelledby="lim-h">
            <h2 id="lim-h">Limitations</h2>
            <ul className="plan-list">{r.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
        )}

        <section className="ar-section">
          <details>
            <summary>Full structured JSON</summary>
            <pre className="code-sample" tabIndex={0}><code>{JSON.stringify(r, null, 2)}</code></pre>
          </details>
          <p className="fine">Questions or a refund request? Email <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>. This report is a passive public-surface assessment, not legal advice, an accessibility certification, or a guarantee of AI visibility.</p>
        </section>
      </article>
    </PageShell>
  );
}
