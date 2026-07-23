import { PageShell } from "../components/SiteChrome.js";

export const metadata = {
  title: "Changelog — Santos Website Intelligence API",
  description: "Product and version history for the Santos Website Intelligence API: Agent Readiness, x402 pricing, OpenAPI, llms.txt, capability manifests, deep audits, and render products.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES = [
  {
    version: "2.8.0",
    date: "2026-07-23",
    items: [
      "Batch Quick Intelligence Audit (POST /api/audit/batch, $0.10 USDC): up to 10 URLs in one payment, per-URL failure isolation; settles only when at least one audit succeeds.",
    ],
  },
  {
    version: "2.7.1",
    date: "2026-07-22",
    items: [
      "Free Agent Readiness demo (GET /api/agent-readiness/demo) — shared 1/day/IP quota, same result shape as the paid audit; added to OpenAPI, llms.txt, the service manifest, and the MCP audit_agent_readiness handoff.",
      "Demo-exhaustion 429 responses now carry for_humans (card checkout pointer) and retry_after across all five demo endpoints; the browser widget offers email capture (POST /api/leads) when the daily quota is spent.",
      "First-party analytics now persist to a durable store; payment_completed is recorded for both x402 and Stripe settlements.",
      "New trust surfaces: /status, /changelog, /version. robots.txt simplified to open-by-default for agent discovery.",
      "Fix: human card checkout now charges the advertised $5 (was $19 server-side).",
    ],
  },
  {
    version: "2.7.0",
    date: "2026-07-20",
    items: [
      "Structured Extraction (POST /v1/extract/structured, $0.08 USDC): LLM-extracted JSON validated against the caller's own JSON Schema; settles only when output validates.",
      "New extract_structured_data MCP tool with a shared-quota free preview.",
    ],
  },
  {
    version: "2.6.0",
    date: "2026-07-19",
    items: [
      "Screenshot & PDF Render (GET /v1/screenshot, $0.01 USDC): real-Chromium PNG/JPEG/PDF, desktop or mobile, optional full-page capture.",
    ],
  },
  {
    version: "2.5.0",
    date: "2026-07-19",
    items: [
      "Safe Fetch (GET/POST /v1/fetch, $0.002 USDC): raw text body of one public URL through the SSRF-guarded fetcher, with redirects, headers, and timing.",
    ],
  },
  {
    version: "2.4.0",
    date: "2026-07-19",
    items: [
      "Page-to-Markdown Extraction (POST /v1/extract, $0.005 USDC): readability-isolated main content as clean Markdown with title, links, and metadata.",
    ],
  },
  {
    version: "2.3.1",
    date: "2026-07-18",
    items: [
      "x402 Bazaar discovery extension with per-route input/output schemas; agent-friendly robots.txt Allow rules for paid endpoints.",
    ],
  },
  {
    version: "2.3.0",
    date: "2026-07-18",
    items: [
      "Human card checkout for the Agent Readiness Report (Stripe, one-time).",
      "Nonce + strict-dynamic CSP; human-friendly GET explainer on the /mcp endpoint.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <PageShell>
    <article className="legal-page">
      <a className="legal-back" href="/">← Santos Website Intelligence</a>
      <h1>Changelog.</h1>
      <p>
        Product history for the Santos Website Intelligence API. Latest version:{" "}
        <strong>2.8.0</strong>. Machine-readable version and contract data:{" "}
        <a href="/version">/version</a>.
      </p>

      {ENTRIES.map((e) => (
        <section key={e.version}>
          <h2>{e.version} — {e.date}</h2>
          <ul>
            {e.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ))}
    </article>
    </PageShell>
  );
}
