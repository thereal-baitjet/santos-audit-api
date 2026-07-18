import { PageShell } from "../../components/SiteChrome.js";
import BuyForm from "./BuyForm.js";
import { getAgentReadinessPriceUsdc } from "../../../lib/agent-readiness/product-pricing.js";

const X402_PRICE = getAgentReadinessPriceUsdc();

export const metadata = {
  title: "Buy an Agent Readiness Report ($19, card) | Santos Website Intelligence",
  description:
    "Get a one-time AI Agent Readiness Report for your website — $19 by card, no account, emailed to you. Measures how discoverable, understandable, callable, and trustworthy your site is to AI agents, with evidence and prioritized fixes.",
  alternates: { canonical: "/agent-readiness/buy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Buy an Agent Readiness Report ($19)",
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
          <p className="kicker">For humans · card payment</p>
          <h1>Get your Agent Readiness Report</h1>
          <p className="lede">
            One-time <strong>$19</strong> report on how ready your website is for the
            agentic web — discoverability, understandability, callability, and trust,
            with evidence and prioritized fixes. No account, no wallet, no subscription.
            Pay by card and we email you a private link to your report.
          </p>
        </header>

        <section className="ar-section" aria-labelledby="buy-h">
          <h2 id="buy-h" className="sr-only">Purchase</h2>
          <div className="audit-box"><BuyForm /></div>
        </section>

        <section className="ar-section two-tracks" aria-labelledby="tracks-h">
          <h2 id="tracks-h">Two ways to buy</h2>
          <div className="track-grid">
            <div className="track">
              <h3>Humans</h3>
              <p className="track-price">$19 <span>one-time report</span></p>
              <p>Pay by card, get an emailed report. No account, no crypto. This page.</p>
            </div>
            <div className="track">
              <h3>Agents</h3>
              <p className="track-price">{X402_PRICE} USDC <span>per call via x402</span></p>
              <p>Machine-payable per audit on Base mainnet, no account or API key.
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
