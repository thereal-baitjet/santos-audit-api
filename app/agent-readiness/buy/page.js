import { PageShell } from "../../components/SiteChrome.js";
import BuyForm from "./BuyForm.js";
import { getAgentReadinessPriceUsdc } from "../../../lib/agent-readiness/product-pricing.js";
import { stripeConfigured } from "../../../lib/stripe/client.js";

const X402_PRICE = getAgentReadinessPriceUsdc();

export const metadata = {
  title: "Buy an Agent Readiness Report ($5, card) | Santos Website Intelligence",
  description:
    "Get a one-time AI Agent Readiness Report for your website — $5 by card, no account, emailed to you. Measures how discoverable, understandable, callable, and trustworthy your site is to AI agents, with evidence and prioritized fixes.",
  alternates: { canonical: "/agent-readiness/buy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Buy an Agent Readiness Report ($5)",
    description: "One-time card purchase, emailed to you. Is your site ready for AI agents?",
    url: "/agent-readiness/buy",
    type: "website",
  },
};

export default function BuyPage() {
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">For agents · optional human card purchase</p>
          <h1>Get your Agent Readiness Report</h1>
          <p className="lede">
            The primary path for agents is <strong>{X402_PRICE} USDC</strong> per successful
            audit via x402 on Base. This page is the optional one-time <strong>$5</strong>
            card purchase for humans who want a report by email — discoverability,
            understandability, callability, and trust, with evidence and prioritized fixes.
            No account, no wallet, no subscription.
          </p>
        </header>

        <section className="ar-section" aria-labelledby="buy-h">
          <h2 id="buy-h" className="sr-only">Purchase</h2>
          <div className="audit-box">
            {stripeConfigured() ? (
              <BuyForm />
            ) : (
              <div className="ar-form buy-form" role="status">
                <p><strong>Card checkout is almost ready.</strong> We're finishing setup
                  with our payment provider — check back shortly.</p>
                <p className="fine">
                  Can't wait? Email{" "}
                  <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>{" "}
                  and we'll run your report manually, or use the{" "}
                  <a href="/agent-readiness/run">x402 endpoint</a> if you have a funded
                  USDC wallet on Base.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="ar-section two-tracks" aria-labelledby="tracks-h">
          <h2 id="tracks-h">Two ways to buy</h2>
          <div className="track-grid">
            <div className="track">
              <h3>Humans</h3>
              <p className="track-price">$5 <span>one-time report</span></p>
              <p>Optional card purchase for a report by email. No account, no crypto. This page.</p>
            </div>
            <div className="track">
              <h3>Agents</h3>
              <p className="track-price">{X402_PRICE} USDC <span>per successful audit via x402</span></p>
              <p>Primary machine-payable path on Base mainnet, no account or API key.
                {" "}<a href="/agent-readiness/run">Use the x402 endpoint →</a></p>
            </div>
          </div>
          <p className="fine">
            Refunds are handled by email — contact{" "}
            <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>.
            This report is not legal advice, an accessibility certification, penetration
            testing, or a guarantee of AI visibility. See the{" "}
            <a href="/reports/sample-agent-readiness">sample report</a>.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
