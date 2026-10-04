import { Activity, ArrowUpRight, ScanLine, Zap } from "lucide-react";
import { PageShell } from "../components/SiteChrome.js";
import { apiProducts, humanProducts, usdLabel, usdcLabel } from "../../lib/products.js";
import styles from "./pricing.module.css";

export const metadata = {
  title: "Pricing | Santos Website Intelligence",
  description: "Compare Santos Quick and Deep Reports, weekly monitoring, and pay-per-use website intelligence APIs. Clear prices for people and agents.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Santos Website Intelligence",
    description: "One-time reports, weekly monitoring, and pay-per-use APIs.",
    url: "/pricing",
    type: "website",
  },
};

const icons = { quick: Zap, deep: ScanLine, monitoring: Activity };

export default function PricingPage() {
  const reports = humanProducts();
  const capabilities = apiProducts();

  return (
    <PageShell>
      <header className={styles.hero}>
        <p className="s-eyebrow">CLEAR EVIDENCE. CLEAR PRICING.</p>
        <h1>Clear pricing.<br /><span>Better decisions.</span></h1>
        <p className={styles.intro}>
          Get the evidence you need today. Keep watch over your website.
          Or build Santos intelligence into your own product.
        </p>
        <div className={styles.links}>
          <a className="s-button s-button-gold" href="#reports">Compare reports</a>
          <a className="s-button s-button-outline" href="#api">Explore API pricing <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </header>

      <section className={styles.section} id="reports" aria-labelledby="reports-heading" data-analytics-event="pricing_viewed">
        <div className="s-section-heading">
          <p className="s-eyebrow">FOR PEOPLE</p>
          <h2 id="reports-heading">Reports and monitoring</h2>
          <p className="s-section-description">Pay by card. Choose a one-time report or a monthly monitoring subscription.</p>
        </div>
        <div className="s-pricing-grid">
          {reports.map((product) => {
            const Icon = icons[product.tier];
            const deep = product.tier === "deep";
            const href = deep ? `${product.url}?tier=deep` : product.url;
            return (
              <article className={`s-price-card ${deep ? "featured" : ""} ${styles.card}`} key={product.id} aria-labelledby={`${product.id}-heading`}>
                {deep && <span className="s-price-featured-label">THE DEEPER PICTURE</span>}
                <span className="s-price-icon"><Icon size={22} aria-hidden="true" /></span>
                <h3 id={`${product.id}-heading`}>{product.name}</h3>
                <div className="s-price">{usdLabel(product.priceUsd)}<span>{product.billing === "monthly" ? "/ month" : "one time"}</span></div>
                <p className={styles.summary}>{product.summary}</p>
                <a className={`s-button ${deep ? "s-button-gold" : "s-button-outline"}`} href={href}>
                  {product.tier === "monitoring" ? "Start monitoring" : `Get ${product.name}`}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
        <p className={styles.note}>Quick and Deep Reports are one-time purchases. Monitoring renews monthly; cancel anytime.</p>
      </section>

      <section className={styles.section} id="api" aria-labelledby="api-heading">
        <div className="s-section-heading">
          <p className="s-eyebrow">FOR DEVELOPERS &amp; AGENTS</p>
          <h2 id="api-heading">Pay for what you use.</h2>
          <p className="s-section-description">
            {capabilities.length} capabilities. Pay per request in USDC on Base through x402.
            Each endpoint returns its payment terms before you pay.
          </p>
        </div>
        <ul className={styles.catalog} aria-label="API prices">
          {capabilities.map((product) => (
            <li className={styles.apiProduct} key={product.id}>
              <div>
                <h3>{product.name}</h3>
                <code>{product.method} {product.route}</code>
                <p>{product.summary}</p>
              </div>
              <div className={styles.apiPrice}>
                <strong>{usdcLabel(product.priceUsdc)}</strong>
                <span>{product.billingUnit}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.links}>
          <a className="s-button s-button-gold" href="/docs">Read the API docs <ArrowUpRight size={16} aria-hidden="true" /></a>
          <a className="s-button s-button-outline" href="/integrations">Connect your agent</a>
        </div>
        <p className={styles.note}>Not sure where to start? <a href="/reports/sample-agent-readiness">Explore a sample report</a> or <a href="mailto:info@santosautomation.com">talk to the builder</a>.</p>
      </section>
    </PageShell>
  );
}
