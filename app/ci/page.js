import { PageShell } from "../components/SiteChrome.js";
import CopyButton from "./CopyButton.js";

export const metadata = {
  title: "Agent Readiness in CI — Gate Pull Requests on Agent-Readiness Scores | Santos",
  description:
    "Fail a pull request when its preview deploy scores below your agent-readiness threshold. Copy-paste GitHub Actions workflow using x402 micropayments (~$0.075 USDC per run).",
  alternates: { canonical: "/ci" },
};

// Kept in sync with examples/agent-readiness-ci.yml (the canonical file).
const WORKFLOW_YAML = `name: Agent Readiness

on:
  pull_request:

# COST: ~$0.075 USDC per run (one quick-depth Agent Readiness audit; payment
# settles only on a successful response, so a failed audit costs nothing).
#
# secrets.X402_PRIVATE_KEY — EVM private key for a DEDICATED wallet holding a
#     few dollars of USDC on Base mainnet (eip155:8453). Buy/send USDC on Base
#     via Coinbase, or bridge. Never reuse a treasury or personal key.
# vars.PREVIEW_URL — publicly reachable URL of the deployed PR preview. The
#     audit runs on Santos infrastructure: localhost, private IPs, and
#     auth-protected previews CANNOT be audited. For Vercel, map the
#     deployment URL into this variable, or point at a staging URL.
# vars.AGENT_READY_MIN (optional) — minimum passing score, default 70.

jobs:
  agent-readiness:
    runs-on: ubuntu-latest
    env:
      PREVIEW_URL: \${{ vars.PREVIEW_URL }}
      AGENT_READY_MIN: \${{ vars.AGENT_READY_MIN || '70' }}
      X402_PRIVATE_KEY: \${{ secrets.X402_PRIVATE_KEY }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install the x402 client
        run: npm install --no-save @x402/fetch @x402/evm viem

      - name: Pay for the audit and enforce the score threshold
        run: |
          cat > agent-readiness-check.mjs <<'EOF'
          import { privateKeyToAccount } from "viem/accounts";
          import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
          import { ExactEvmScheme } from "@x402/evm";

          const account = privateKeyToAccount(process.env.X402_PRIVATE_KEY);
          const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
            schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
          });

          const min = Number(process.env.AGENT_READY_MIN || "70");
          const endpoint =
            "https://api.santosautomation.com/api/agent-readiness?url=" +
            encodeURIComponent(process.env.PREVIEW_URL) + "&depth=quick";

          // Unpaid, the endpoint returns 402 PAYMENT-REQUIRED; fetchWithPay
          // signs the quoted ~$0.075 USDC terms and retries automatically.
          const res = await fetchWithPay(endpoint);
          if (!res.ok) {
            console.error(\`Audit failed: HTTP \${res.status}\`, await res.text());
            process.exit(1);
          }
          const report = await res.json();
          console.log(\`Agent Readiness: score \${report.score}/100, grade \${report.grade}\`);
          if (typeof report.score !== "number" || report.score < min) {
            console.error(\`Score \${report.score} is below the required minimum of \${min}.\`);
            process.exit(1);
          }
          console.log(\`Score \${report.score} >= \${min} — gate passed.\`);
          EOF
          node agent-readiness-check.mjs
`;

export default function CiPage() {
  return (
    <PageShell>
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Agent Readiness in CI</span></div>
        <header className="page-hero">
          <p className="kicker">CI recipe · ~$0.075 USDC per run</p>
          <h1>Gate pull requests on agent readiness</h1>
          <p className="lede">
            Run the Santos Agent Readiness audit against every PR preview and fail the build when
            the score drops below your threshold. Each run pays for one audit over x402 — USDC
            settled inside the HTTP request, no account or API key.
          </p>
          <div className="cta-row">
            <a className="btn" href="/docs">API docs</a>
            <a className="btn" href="/openapi.json" data-analytics-event="openapi_downloaded">OpenAPI</a>
          </div>
        </header>

        <section className="content-section prose-grid">
          <div>
            <h2>What it does</h2>
            <p>
              On each pull request, a GitHub Actions job pays ~$0.075 USDC for a quick-depth
              audit of your preview URL (<code>GET /api/agent-readiness?url=…&amp;depth=quick</code>),
              reads the 0–100 <code>score</code> from the response, and exits non-zero when it is
              below <code>AGENT_READY_MIN</code> (default 70). Payment settles only on a successful
              response — a failed audit costs nothing.
            </p>
          </div>
          <div>
            <h2>Threshold guidance</h2>
            <p>
              Start at <code>70</code> (grade B) as a regression gate: it catches removed llms.txt,
              broken OpenAPI, and lost structured identity without flapping on minor content
              edits. Track your score for a week before tightening; 80+ is a good bar for
              agent-facing products. Audit your baseline first with the{" "}
              <a href="/agent-readiness/run">Agent Readiness audit</a>.
            </p>
          </div>
        </section>

        <section className="content-section">
          <h2>The workflow</h2>
          <p className="sub">
            Drop this in <code>.github/workflows/agent-readiness.yml</code>, set{" "}
            <code>secrets.X402_PRIVATE_KEY</code> (a dedicated wallet with a few dollars of USDC on
            Base) and <code>vars.PREVIEW_URL</code>. Not on GitHub?{" "}
            <code>examples/agent-readiness-ci.sh</code> in the repo is the same gate in plain bash —
            and any x402 v2 client works for the payment step.
          </p>
          <p><CopyButton text={WORKFLOW_YAML} /></p>
          <pre className="code-sample" tabIndex={0}><code>{WORKFLOW_YAML}</code></pre>
        </section>

        <section className="content-section prose-grid">
          <div>
            <h2>The preview URL must be public</h2>
            <p>
              The audit runs on Santos infrastructure, so the preview must be reachable from the
              public internet — localhost, private IPs, and authentication-protected previews
              cannot be audited. On Vercel, map the deployment URL into the job; on other hosts,
              point at a per-PR staging URL.
            </p>
          </div>
          <div>
            <h2>Cost control</h2>
            <p>
              At ~$0.075 per run, a busy repo may prefer path filters, a nightly schedule, or
              gating only merges to main. The spending key is a dedicated wallet — fund it with
              only what you expect to spend. Full payment flow: <a href="/docs">docs</a> and{" "}
              <a href="/openapi.json">openapi.json</a>.
            </p>
          </div>
        </section>

        <section className="content-section related">
          <h2>Continue evaluating</h2>
          <div className="related-links">
            <a href="/docs">API documentation<span aria-hidden="true"> →</span></a>
            <a href="/openapi.json">OpenAPI specification<span aria-hidden="true"> →</span></a>
            <a href="/agent-readiness-audit">Agent Readiness Audit<span aria-hidden="true"> →</span></a>
          </div>
        </section>
      </article>
    </PageShell>
  );
}
