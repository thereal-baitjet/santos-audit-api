import { PageShell } from "../components/SiteChrome.js";

export const metadata = {
  title: "Changelog — Santos Website Intelligence API",
  description: "Product and version history for the Santos Website Intelligence API: Agent Readiness, x402 pricing, OpenAPI, llms.txt, capability manifests, deep audits, and render products.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES = [
  {
    version: "2.15.0",
    date: "2026-07-28",
    items: [
      "Claude integration guide at /integrations/claude: add the existing MCP endpoint as a Claude custom connector. No server change — protocol testing confirmed the deployed endpoint is already Claude-compatible, so Claude and Grok share one server, one registry listing, and one tool set.",
      "Capability manifest gains mcp_registry (a direct official-registry verification URL) and lists Claude alongside Grok in mcp_clients.",
      "llms.txt MCP clients section now covers both clients and links the registry record; /docs section broadened to Grok, Claude & MCP clients.",
      "No endpoint, tool name, schema, free-quota, or x402 pricing change.",
    ],
  },
  {
    version: "2.14.0",
    date: "2026-07-28",
    items: [
      "Free MCP tools accept an optional verified-email token. Without one the daily free quota is keyed on the caller IP, which every caller behind that address shares — a hosted agent like Grok egresses from a handful of addresses, so its entire user base was sharing a single free call per day. Raising the per-IP number would not have fixed that; the identity was wrong, not the limit.",
      "An invalid token is rejected outright rather than falling back to the IP allowance, so a junk token can never be a way around a spent quota.",
      "Grok integration page gains a copyable sample prompt and the token walkthrough; README carries a Grok Remote MCP badge.",
    ],
  },
  {
    version: "2.13.0",
    date: "2026-07-28",
    items: [
      "Grok & xAI integration guide at /integrations/grok: register the Santos MCP server as a Grok Remote MCP tool in one line, with the free-preview path first and the paid x402 handoff second. No backend change — Grok speaks Remote MCP and Santos already publishes one.",
      "Capability manifest declares MCP client compatibility: new mcp_transport (streamable-http) and mcp_clients fields, so an agent can confirm Grok compatibility from the manifest without reading prose.",
      "llms.txt gains an ## MCP clients section with the exact xai_sdk registration snippet, and links the integration guide from Machine surfaces.",
      "/docs gains a Grok & xAI section; the integration is linked from primary navigation, the homepage integration grid, the footer, and the sitemap.",
    ],
  },
  {
    version: "2.12.0",
    date: "2026-07-28",
    items: [
      "Scoring accuracy: prices no longer bind to a neighbouring route. The pricing extractor read a fixed window around each price and took the first URL in it, so in a catalogue list the price on one line could be recorded against the route on the line above — and then reported as contradicting the enforced price. Any API whose routes share a path prefix was affected.",
      "An illustrative rate in parentheses ($0.50 flat per batch ($0.01/URL at full capacity)) is no longer read as a second, competing price for the same route.",
      "A pricing contradiction now requires enforced terms. A single URL selling more than one product — a checkout page with a $9 and a $29 report — was being reported as contradicting itself; contradictions are only raised against an actual x402 challenge.",
      "Paid-resource probing selects a real endpoint: specification and documentation artifacts (openapi.json, llms.txt, capability manifests) are excluded, a resource carrying a real x402 price outranks a link whose label merely mentions payment, and display placeholders (?url=…) are stripped before probing.",
      "Santos Index: santosautomation.com re-audited at 100 (was 94). The site did not change — three of its findings were false positives from the defects above. The same corrected engine scores every domain; the index average is unchanged at 59.6 across 311 domains.",
    ],
  },
  {
    version: "2.11.0",
    date: "2026-07-27",
    items: [
      "Tiered human reports by card at /agent-readiness/buy: Quick Agent Readiness Report ($9, fetch-based) and Deep Website Intelligence Report ($29, browser-rendered) — one-time, formatted, emailed, and verifiable. The retired $5 report is gone; x402 prices are the agent price (raw API), card prices are the human report.",
      "Santos Monitoring (/monitoring, $9/mo by card): weekly re-audit of one URL with the same engine, an email alert when the score moves 5+ points, and a monthly digest. Cancel anytime via the manage link in every monitoring email.",
      "Lifecycle emails with index comparison: report and monitoring emails show the score alongside the Santos Index average across 300+ public reports.",
      "Daily cron drives the weekly re-audits, regression alerts, and digests for active subscriptions.",
      "Human checkout CTAs site-wide: homepage, docs, MCP explainer, and widgets point to /agent-readiness/buy and /monitoring.",
      "The Santos Index now covers 310+ public reports — site copy updated from 200+ to 300+.",
    ],
  },
  {
    version: "2.10.0",
    date: "2026-07-26",
    items: [
      "Santos Feed Parser (GET/POST /v1/feed, $0.003 USDC): one feed URL to normalized JSON — detects RSS 2.0, Atom, and JSON Feed through the SSRF-guarded fetcher; returns feed metadata plus up to 50 items; non-feed targets return 422 and never settle.",
      "Santos Link Map (GET/POST /v1/links, $0.003 USDC): one HTML page to a categorized link map — every link (max 200) with an internal/external kind plus topic tags (docs, pricing, api, careers, social, feed) and per-category counts.",
      "Santos Summarizer (POST/GET /v1/summarize, $0.033 USDC): one HTML page to a Claude-generated structured summary (title, summary, key_facts, entities, word_count) with an optional focus steering prompt; non-HTML targets return 422 and never settle.",
      "New MCP tools feed_parse, link_map, and summarize: each validates the target and returns the canonical x402 HTTP handoff for its paid endpoint — MCP never executes or settles the paid call.",
      "Buyer examples: buy-feed.js, buy-links.js, buy-summarize.js. Discovery surfaces updated: OpenAPI, llms.txt, capabilities manifest, /api service manifest, and /docs.",
    ],
  },
  {
    version: "2.9.0",
    date: "2026-07-23",
    items: [
      "Verified-email free audits: GET /api/audit/free runs the full Quick Intelligence audit once per day per verified email (6-digit code flow at /api/leads/verify/*, token valid 30 days). The browser widget now captures email up front.",
      "Public reports + leaderboard: opted-in audit scores are published at /reports/<domain> with a top-50 leaderboard at /reports.",
      "Agent-Ready badge: GET /v1/badge?url=… returns a free SVG shield of a site's latest public score — embed it in any README.",
      "llms.txt generator: GET /v1/llms-txt/demo drafts a standards-shaped llms.txt from a one-page sample (verified-email free tier, shared 1/day quota); tool page at /llms-txt-generator.",
      "Signed reports + POST /v1/verify: audit reports now carry an HMAC-SHA256 signature; verify any report free at /v1/verify (30/hour) or the /verify page.",
      "CI recipe: examples/agent-readiness-ci.yml and .sh gate pull requests on the Agent Readiness score (~$0.075 USDC/run via x402); guide at /ci.",
    ],
  },
  {
    version: "2.8.1",
    date: "2026-07-23",
    items: [
      "Batch Quick Intelligence Audit is now flat $0.50 USDC for up to 50 URLs (was $0.10 / 10 URLs) — $0.01 per URL at full capacity.",
    ],
  },
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
        <strong>2.15.0</strong>. Machine-readable version and contract data:{" "}
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
