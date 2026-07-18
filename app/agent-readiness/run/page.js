import { PageShell } from "../../components/SiteChrome.js";
import AgentReadinessRun from "./AgentReadinessRun.js";
import { getAgentReadinessPriceUsdc } from "../../../lib/agent-readiness/product-pricing.js";

const PRICE = getAgentReadinessPriceUsdc();

export const metadata = {
  title: `Run a Paid Agent Readiness Audit (${PRICE} USDC) | Santos Website Intelligence`,
  description:
    "Run a paid Agent Readiness audit of any public website or service. Review the live x402 payment terms — amount, recipient, asset, and network — before you sign. Pay in USDC on Base mainnet; no account or API key.",
  alternates: { canonical: "/agent-readiness/run" },
  // The page is indexable; payment-result and query-specific states are not
  // linked or crawlable (all interaction is client-side, no result URLs).
  robots: { index: true, follow: true },
  openGraph: {
    title: "Run a Paid Agent Readiness Audit | Santos Website Intelligence",
    description: "Review the live x402 payment terms before signing. USDC on Base mainnet.",
    url: "/agent-readiness/run",
    type: "website",
  },
};

export default function AgentReadinessRunPage() {
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">Paid capability</p>
          <h1>Run a Paid Agent Readiness Audit</h1>
          <p className="lede">
            Assess how well a public website or service can be discovered, understood,
            invoked, and — where applicable — paid by AI agents. {PRICE} USDC per
            successful audit, settled on Base mainnet via x402 v2. No account, no API key.
          </p>
        </header>

        <section className="ar-section" aria-labelledby="run-h">
          <h2 id="run-h" className="sr-only">Start the audit</h2>
          <AgentReadinessRun />
        </section>

        <section className="ar-section" aria-labelledby="what-h">
          <h2 id="what-h">What you get</h2>
          <ul className="plan-list">
            <li>Discoverability, understandability, invocability, and payability coverage with evidence</li>
            <li>Checks for MCP, llms.txt, OpenAPI, structured data, and crawler access</li>
            <li>Category scores, pass/fail checks, and prioritized fixes as structured JSON</li>
            <li>Passive only — the auditor never authenticates to, pays, or submits forms on the target</li>
          </ul>
          <p className="fine">
            This is not legal advice, an accessibility certification, penetration testing,
            or a guarantee of AI visibility. See the{" "}
            <a href="/reports/sample-agent-readiness">sample report</a> and{" "}
            <a href="/methodology/agent-readiness">methodology</a>.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
