import { apiProduct, humanProduct, usdLabel } from "../lib/products.js";

// The landing conversion block.
//
// This used to be a live free scan: enter a URL and an email, get a real audit,
// maybe buy. The free tier is retired, so the job of proving output quality now
// falls to reports we have ALREADY run — 300+ of them, stored in public_reports
// and served at /reports/<domain>. Same proof, no per-visitor compute, no
// quota, nothing to abuse.
//
// The featured domains are hardcoded on purpose. Reading them from Postgres
// would put a database round trip on the single highest-traffic page on the
// site, which is exactly the connection pressure that took the limiter down on
// 2026-07-30. The report pages themselves render live from the database; this
// block only needs to link to them.
const FEATURED = [
  { domain: "cloudflare.com", note: "infrastructure" },
  { domain: "planetscale.com", note: "developer tooling" },
  { domain: "harvard.edu", note: "institutional" },
];

export default function AuditWidget() {
  const quickApi = apiProduct("/api/audit");
  const quickReport = humanProduct("quick");
  const deepReport = humanProduct("deep");

  return (
    <div className="audit-widget" data-audit-widget>
      <p className="audit-lede">
        See exactly what a Santos report looks like before you buy one — these are real audits, not samples.
      </p>

      <ul className="audit-examples">
        {FEATURED.map(({ domain, note }) => (
          <li key={domain}>
            <a href={`/reports/${domain}`}>{domain}</a> <span className="audit-example-note">{note}</span>
          </li>
        ))}
      </ul>

      <p className="audit-browse">
        <a href="/reports">Browse every scored domain<span aria-hidden="true"> →</span></a>
      </p>

      <div className="audit-actions">
        <a className="btn primary" href="/agent-readiness/buy" data-analytics-event="buy_report_clicked">
          Get your report — {usdLabel(quickReport.priceUsd)} Quick / {usdLabel(deepReport.priceUsd)} Deep
        </a>
      </div>

      <p className="audit-note" id="audit-note">
        No account needed. Agents: <code>GET /api/audit?url=…</code> · {quickApi.priceUsdc} USDC via x402 · no API key
      </p>
    </div>
  );
}
