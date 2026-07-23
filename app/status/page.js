import { PageShell } from "../components/SiteChrome.js";

export const metadata = {
  title: "Service Status — Santos Website Intelligence",
  description: "Current availability and operational expectations for the Santos Website Intelligence API, audit products, and x402 payments.",
  alternates: { canonical: "/status" },
};

const COMPONENTS = [
  { name: "Website", note: "www.santosautomation.com marketing site, docs, and free browser demos" },
  { name: "Quick Audit API", note: "GET /api/audit — synchronous fetch-and-parse audit ($0.015 USDC via x402)" },
  { name: "Agent Readiness API", note: "GET /api/agent-readiness — bounded passive assessment ($0.075 USDC via x402)" },
  { name: "Deep Audit Worker", note: "POST /v1/audits — asynchronous browser-rendered jobs on an isolated Fly.io worker ($0.225 USDC)" },
  { name: "Screenshot/PDF Render", note: "GET /v1/screenshot — synchronous Chromium renders via the worker queue ($0.01 USDC)" },
  { name: "x402 Payments", note: "USDC settlement on Base mainnet via the Coinbase CDP facilitator" },
];

export default function StatusPage() {
  return (
    <PageShell>
    <article className="legal-page">
      <a className="legal-back" href="/">← Santos Website Intelligence</a>
      <h1>Service status.</h1>
      <p>
        <strong>Current status: Operational.</strong> This is a lightweight public
        status page with operational expectations — it is not a live SLA monitor
        and is not wired to automated health checks.
      </p>

      <h2>Components</h2>
      <ul>
        {COMPONENTS.map((c) => (
          <li key={c.name}><strong>{c.name}</strong> — Operational. {c.note}.</li>
        ))}
      </ul>

      <h2>Operational expectations</h2>
      <ul>
        <li>Synchronous endpoints (Quick Audit, Agent Readiness, Safe Fetch, Extraction, Screenshot) respond in seconds; Deep audits are asynchronous jobs polled via their status URL.</li>
        <li>x402 payments settle only after a successful response — a failed or blocked audit is not charged. Deep audits settle when the job is accepted (a bounded compute reservation).</li>
        <li>Free demos are limited to one request per day per IP, shared across all demo endpoints.</li>
      </ul>

      <h2>Support</h2>
      <p>
        Problems, replacement-run requests caused by Santos infrastructure, or
        billing questions: <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>.
      </p>
    </article>
    </PageShell>
  );
}
