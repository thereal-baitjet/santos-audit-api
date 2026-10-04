import { PageShell } from "../../components/SiteChrome.js";
import BuyForm from "./BuyForm.js";
import { humanProducts, usdLabel } from "../../../lib/products.js";
import { getAgentReadinessPriceUsdc } from "../../../lib/agent-readiness/product-pricing.js";
import { stripeConfigured } from "../../../lib/stripe/client.js";

const X402_PRICE = getAgentReadinessPriceUsdc();

export const metadata = {
  title:
    "Buy a Website Report by Card ($9 Quick / $29 Deep) | Santos Website Intelligence",
  description:
    "Get a one-time human report for your website by card — $9 Quick (Agent Readiness, fetch-based evidence) or $29 Deep (Website Intelligence, browser-rendered Lighthouse + axe-core + screenshots), no account, emailed to you.",
  alternates: { canonical: "/agent-readiness/buy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Buy a Website Report by Card ($9 Quick / $29 Deep)",
    description:
      "One-time card purchase, emailed to you. Is your site ready for AI agents?",
    url: "/agent-readiness/buy",
    type: "website",
  },
};

export default async function BuyPage({ searchParams }) {
  const params = await searchParams;
  const products = humanProducts().filter((product) =>
    ["quick", "deep"].includes(product.tier),
  );
  const tiers = products.map((product) => ({
    key: product.tier,
    name: product.tier === "quick" ? "Quick" : "Deep",
    price: usdLabel(product.priceUsd),
    blurb: product.summary,
  }));
  const quickPrice = tiers[0].price;
  const deepPrice = tiers[1].price;
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">YOUR WEBSITE, UNDERSTOOD</p>
          <h1>Get your Website Report</h1>
          <p className="lede">
            See your website through an AI agent’s eyes, with evidence and a
            clear plan for what to fix. Choose a{" "}
            <strong>{quickPrice} Quick Report</strong> for fetch-based agent
            readiness, or a <strong>{deepPrice} Deep Report</strong> for
            real-browser evidence, Lighthouse, accessibility checks, and
            screenshots. Pay once by card. Your formatted report arrives by
            email. No account needed.
          </p>
        </header>

        <section className="ar-section" aria-labelledby="buy-h">
          <h2 id="buy-h" className="sr-only">
            Purchase
          </h2>
          <div className="audit-box">
            {stripeConfigured() ? (
              <BuyForm
                initialTier={params?.tier === "deep" ? "deep" : "quick"}
                tiers={tiers}
              />
            ) : (
              <div className="ar-form buy-form" role="status">
                <p>
                  <strong>Card checkout is almost ready.</strong> We're
                  finishing setup with our payment provider — check back
                  shortly.
                </p>
                <p className="fine">
                  Can't wait? Email{" "}
                  <a
                    href="mailto:info@santosautomation.com"
                    data-analytics-event="contact_clicked"
                  >
                    info@santosautomation.com
                  </a>{" "}
                  and we'll run your report manually, or use the{" "}
                  <a href="/agent-readiness/run">x402 endpoint</a> if you have a
                  funded USDC wallet on Base.
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
              <p className="track-price">
                {quickPrice}–{deepPrice} <span>one-time report</span>
              </p>
              <p>
                Optional card purchase for a formatted report by email — Quick (
                {quickPrice}) or Deep, browser-rendered ({deepPrice}). No
                account, no crypto. This page.
              </p>
            </div>
            <div className="track">
              <h3>Agents</h3>
              <p className="track-price">
                {X402_PRICE} USDC <span>per successful audit via x402</span>
              </p>
              <p>
                Primary machine-payable path on Base mainnet, no account or API
                key. <a href="/agent-readiness/run">Use the x402 endpoint →</a>
              </p>
            </div>
          </div>
          <p className="fine">
            Refunds are handled by email — contact{" "}
            <a
              href="mailto:info@santosautomation.com"
              data-analytics-event="contact_clicked"
            >
              info@santosautomation.com
            </a>
            . This report is not legal advice, an accessibility certification,
            penetration testing, or a guarantee of AI visibility. See the{" "}
            <a href="/reports/sample-agent-readiness">sample report</a>.
          </p>
        </section>
      </article>
    </PageShell>
  );
}
