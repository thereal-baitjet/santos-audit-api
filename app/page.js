import Image from "./components/CspImage.js";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  Code2,
  Fingerprint,
  Globe2,
  Layers3,
  Radio,
  ScanLine,
  Search,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import IntelligencePreview from "./components/IntelligencePreview.js";
import DeveloperExample from "./components/DeveloperExample.js";
import { PageShell } from "./components/SiteChrome.js";
import StructuredData from "./components/StructuredData.js";
import { FAQS } from "../lib/marketing-content.js";
import {
  PAID_CAPABILITY_COUNT,
  apiProducts,
  entryPriceUsdc,
  humanProducts,
  usdLabel,
} from "../lib/products.js";
import { INDEX_STATS } from "../lib/index-stats.js";

const api = apiProducts();
const humans = humanProducts();
const quickReport = humans.find((product) => product.tier === "quick");
const deepReport = humans.find((product) => product.tier === "deep");
const monitoring = humans.find((product) => product.tier === "monitoring");

const homepageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebAPI",
  "@id": "https://api.santosautomation.com/#api",
  name: "Santos Website Intelligence API",
  alternateName: "Santos Agent Readiness API",
  url: "https://api.santosautomation.com/api",
  documentation: "https://api.santosautomation.com/openapi.json",
  termsOfService: "https://www.santosautomation.com/terms",
  provider: { "@id": "https://www.santosautomation.com/#organization" },
  serviceType: "AI Website Intelligence API",
  description:
    "An API that measures whether websites can be discovered, understood, trusted, and used by AI agents.",
  offers: [
    ...api.map((product) => ({
      "@type": "Offer",
      name: product.name,
      price: product.priceUsdc,
      priceCurrency: "USDC",
      url: `https://api.santosautomation.com${product.route}`,
    })),
    ...humans.map((product) => ({
      "@type": "Offer",
      name: `${product.name} (human checkout, by card)`,
      price: String(product.priceUsd),
      priceCurrency: "USD",
      url: `https://www.santosautomation.com${product.url}`,
    })),
  ],
};
const founderJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://www.santosautomation.com/#founder",
  name: "Juan Santos",
  jobTitle: "Founder & Engineer, Santos Automation",
  worksFor: { "@id": "https://www.santosautomation.com/#organization" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Charlotte",
    addressRegion: "NC",
    addressCountry: "US",
  },
  image: "https://www.santosautomation.com/assets/santos-portrait.png",
  email: "info@santosautomation.com",
  sameAs: [
    "https://github.com/thereal-baitjet",
    "https://www.linkedin.com/in/santosjuanc/",
    "https://instagram.com/mr.j.c.santos",
  ],
};

const dimensions = [
  {
    name: "Discoverable",
    question: "Can agents find you?",
    description:
      "Crawl access, sitemaps, llms.txt, and the signals that put your website on the map.",
    icon: Search,
    code: "robots.txt · sitemap.xml · llms.txt",
    className: "discovery",
  },
  {
    name: "Understandable",
    question: "Can agents make sense of you?",
    description:
      "Structured data and semantic context that turn a page into something machines understand.",
    icon: Braces,
    code: "JSON-LD · semantic HTML · metadata",
    className: "understanding",
  },
  {
    name: "Callable",
    question: "Can agents work with you?",
    description:
      "Clear interfaces, typed schemas, and predictable responses for real interactions.",
    icon: Workflow,
    code: "OpenAPI · MCP · capabilities",
    className: "callability",
  },
  {
    name: "Trustworthy",
    question: "Can agents rely on you?",
    description:
      "Security, accessibility, and performance signals backed by inspectable evidence.",
    icon: ShieldCheck,
    code: "HTTPS · accessibility · performance",
    className: "trust",
  },
];

function SectionHeading({ label, title, children, centered = false }) {
  return (
    <div className={`s-section-heading${centered ? " centered" : ""}`}>
      <p className="s-eyebrow">
        <span />
        {label}
      </p>
      <h2>{title}</h2>
      {children && <p className="s-section-description">{children}</p>}
    </div>
  );
}

function Action({ href, children, secondary = false, ...props }) {
  return (
    <a
      className={`s-button ${secondary ? "s-button-outline" : "s-button-gold"}`}
      href={href}
      {...props}
    >
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

export default function Home() {
  return (
    <PageShell className="s-home">
      <StructuredData data={homepageJsonLd} />
      <StructuredData data={founderJsonLd} />
      <section className="s-hero" aria-labelledby="hero-heading">
        <div className="s-hero-copy">
          <a className="s-announcement" href="/reports">
            <span>THE SANTOS INDEX</span>
            {INDEX_STATS.auditedSiteCountLabel} websites. One reality check.
            <ArrowRight size={13} aria-hidden="true" />
          </a>
          <h1 id="hero-heading">
            Be seen.
            <br />
            Be understood.
            <br />
            <em>Be agent-ready.</em>
          </h1>
          <p className="s-hero-description">
            The next visitor to your website might be an AI agent. See what it
            sees. Fix what holds you back.
          </p>
          <div className="s-hero-actions">
            <Action
              href="/agent-readiness/buy"
              data-analytics-event="human_report_selected"
            >
              Get your website report
            </Action>
            <a
              className="s-button s-button-outline"
              href="/reports/sample-agent-readiness"
              data-analytics-event="sample_report_opened"
            >
              <ScanLine size={17} aria-hidden="true" />
              Explore a sample
            </a>
          </div>
          <div className="s-hero-reassurance">
            <span>
              <Check size={13} aria-hidden="true" />
              No account needed
            </span>
            <span>
              <Check size={13} aria-hidden="true" />
              Reports from {usdLabel(quickReport.priceUsd)}
            </span>
            <span>
              <Check size={13} aria-hidden="true" />
              Evidence included
            </span>
          </div>
          <a className="s-hero-developer" href="#integration">
            <Terminal size={14} aria-hidden="true" /> Building with AI? Meet
            your new API.
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        </div>
        <IntelligencePreview />
      </section>

      <section
        className="s-index-strip"
        aria-label="Examples from the Santos Index"
      >
        <p>
          THE WEB, UNDER THE MICROSCOPE
          <span>Independently audited. No affiliation implied.</span>
        </p>
        <div className="s-domain-logos">
          <a href="/reports/cloudflare.com">
            <span className="domain-cloud" aria-hidden="true">
              ☁
            </span>{" "}
            cloudflare
          </a>
          <a href="/reports/planetscale.com">
            <span className="domain-planet" aria-hidden="true" />
            PlanetScale
          </a>
          <a href="/reports/google.com" className="domain-google">
            Google
          </a>
          <a href="/reports/harvard.edu" className="domain-harvard">
            <ShieldCheck size={25} aria-hidden="true" />
            HARVARD
          </a>
          <a href="/reports/oracle.com" className="domain-oracle">
            ORACLE
          </a>
        </div>
      </section>

      <section
        className="s-section"
        id="layers"
        aria-labelledby="dimensions-heading"
      >
        <div className="s-section-intro">
          <SectionHeading
            label="A NEW STANDARD FOR THE WEB"
            title={
              <span id="dimensions-heading">
                Being online is only
                <br />
                the beginning.
              </span>
            }
          >
            Four dimensions reveal the gap between having a website and having
            one AI agents can actually use.
          </SectionHeading>
          <a className="s-text-link" href="/methodology/agent-readiness">
            Explore the methodology{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="s-dimension-grid">
          {dimensions.map(
            (
              { name, question, description, icon: Icon, code, className },
              i,
            ) => (
              <article className={`s-dimension-card ${className}`} key={name}>
                <div className="dimension-card-top">
                  <span className="s-icon-box">
                    <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span>0{i + 1}</span>
                </div>
                <h3>{name}</h3>
                <p className="dimension-question">{question}</p>
                <p className="dimension-description">{description}</p>
                <div className="dimension-code">{code}</div>
              </article>
            ),
          )}
        </div>
        <p className="s-section-footnote">
          <CheckCheck size={14} aria-hidden="true" /> Context matters.
          Informational websites aren’t penalized for not having an API.
        </p>
      </section>

      <section className="s-index-feature" id="see-reports">
        <div className="s-index-copy">
          <p className="s-eyebrow">
            <span />
            THE SANTOS INDEX / {INDEX_STATS.edition.toUpperCase()}
          </p>
          <h2>
            The web isn’t
            <br />
            agent-ready.<em>Yet.</em>
          </h2>
          <p>
            We audited {INDEX_STATS.auditedSiteCountLabel} well-known websites.
            Even the biggest names have blind spots. Every published report
            shows the evidence.
          </p>
          <Action href="/reports" secondary>
            See where the web stands
          </Action>
        </div>
        <div className="s-index-score">
          <span>AVERAGE INTELLIGENCE SCORE</span>
          <strong>
            {INDEX_STATS.averageScore}
            <small>/100</small>
          </strong>
          <p>Across {INDEX_STATS.auditedSiteCount} audited websites</p>
          <div className="index-score-ruler" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="index-score-labels">
            <span>Room to improve</span>
            <span>Agent-ready</span>
          </div>
        </div>
        <div className="s-index-rankings">
          <div className="index-rankings-header">
            <span>FROM THE INDEX</span>
            <span>SCORE</span>
          </div>
          {[
            INDEX_STATS.examples[3],
            INDEX_STATS.examples[0],
            INDEX_STATS.examples[1],
            INDEX_STATS.examples[2],
          ].map(({ domain, score }, i) => (
            <a href={`/reports/${domain}`} key={domain}>
              <span className="index-rank-number">0{i + 1}</span>
              <span>{domain}</span>
              <strong className={score >= 80 ? "high-score" : "low-score"}>
                {score}
              </strong>
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          ))}
          <span className="index-edition">
            A published snapshot. Follow a domain for its report.
          </span>
        </div>
      </section>

      <section className="s-section" id="modes">
        <SectionHeading
          label="FROM SIGNAL TO ACTION"
          title="Less guesswork. A clear next move."
          centered
        >
          A number is a starting point. The evidence tells you what to do next.
        </SectionHeading>
        <div className="s-bento-grid">
          <article className="s-bento-card s-bento-large">
            <div className="bento-label">
              <span className="s-icon-box">
                <Layers3 size={22} aria-hidden="true" />
              </span>
              <span>CHOOSE YOUR DEPTH</span>
            </div>
            <h3>
              A quick pulse.
              <br />
              Or the full picture.
            </h3>
            <p>
              Start with fetch-based signals, or go deeper with an isolated
              browser, screenshots, Lighthouse, and rendered accessibility
              checks.
            </p>
            <div className="s-depth-options">
              <a href="/agent-readiness/buy">
                <Zap size={20} aria-hidden="true" />
                <span>
                  <strong>Quick Report</strong>
                  <small>Fetch-based evidence</small>
                </span>
                <b>{usdLabel(quickReport.priceUsd)}</b>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a href="/agent-readiness/buy?tier=deep">
                <ScanLine size={20} aria-hidden="true" />
                <span>
                  <strong>Deep Report</strong>
                  <small>Real-browser evidence</small>
                </span>
                <b>{usdLabel(deepReport.priceUsd)}</b>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            <a className="s-text-link" href="/ai-website-intelligence">
              Compare audit capabilities{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </article>
          <article className="s-bento-card">
            <div className="s-evidence-illustration" aria-hidden="true">
              <span className="evidence-code-line">
                <Check size={13} />
                Evidence captured
              </span>
              <div>
                <span>impact</span>
                <b>high</b>
              </div>
              <div>
                <span>confidence</span>
                <b>high</b>
              </div>
              <div>
                <span>next_action</span>
                <b>publish_manifest</b>
              </div>
            </div>
            <h3>Every finding has a why.</h3>
            <p>
              Trace scores back to observed evidence, then work through fixes
              ranked by impact.
            </p>
            <a className="s-text-link" href="/reports/sample-agent-readiness">
              Inspect the sample <ArrowRight size={15} aria-hidden="true" />
            </a>
          </article>
          <article className="s-bento-card">
            <div className="s-monitor-illustration" aria-hidden="true">
              <div>
                <Radio size={14} />
                <span>WEEKLY CHECK-IN</span>
                <span className="monitor-live-dot" />
              </div>
              <svg viewBox="0 0 320 90">
                <path
                  className="monitor-grid"
                  d="M0 25H320M0 55H320M0 85H320"
                />
                <path
                  className="monitor-line"
                  d="M0 76L25 68L50 71L78 51L103 57L130 41L157 46L182 27L209 31L235 18L265 24L290 8L320 12"
                />
              </svg>
            </div>
            <h3>Keep your progress in sight.</h3>
            <p>
              Weekly re-audits, meaningful score-change alerts, and a monthly
              digest. One URL, {usdLabel(monitoring.priceUsd)}/month.
            </p>
            <a
              className="s-text-link"
              href="/monitoring"
              data-analytics-event="monitoring_started"
            >
              Explore monitoring <ArrowRight size={15} aria-hidden="true" />
            </a>
          </article>
        </div>
        <p className="s-section-footnote">
          Audits assess one page. Automated checks are not accessibility
          certification or penetration testing. Monitoring graphic is
          illustrative.
        </p>
      </section>

      <section className="s-developer-section s-section" id="integration">
        <div className="s-developer-copy">
          <p className="s-eyebrow">
            <span />
            BUILT FOR BUILDERS
          </p>
          <h2>
            Intelligence in.
            <br />
            <em>Possibility out.</em>
          </h2>
          <p>
            Give your agent a sharper view of the web. One API for audits,
            extraction, summaries, and the evidence behind every decision.
          </p>
          <ul>
            <li>
              <Check size={16} aria-hidden="true" />
              {PAID_CAPABILITY_COUNT} focused, machine-payable capabilities
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              Versioned JSON with structured evidence
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              No account or traditional API key
            </li>
            <li>
              <Check size={16} aria-hidden="true" />
              From ${entryPriceUsdc()} USDC per call
            </li>
          </ul>
          <div className="s-hero-actions">
            <Action href="/docs" data-analytics-event="api_docs_opened">
              Start building
            </Action>
            <a className="s-text-link" href="/integrations">
              Connect via MCP <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <div className="s-protocols">
            <span>OpenAPI 3.1</span>
            <span>MCP</span>
            <span>x402</span>
            <span>Base</span>
          </div>
        </div>
        <DeveloperExample />
      </section>

      <section
        className="s-section s-pricing-section"
        id="pricing"
        data-analytics-event="pricing_viewed"
      >
        <SectionHeading
          label="CLEAR EVIDENCE. CLEAR PRICING."
          title="Your next move starts here."
          centered
        >
          Buy a report. Keep watch over your site. Or build the intelligence
          into your own product.
        </SectionHeading>
        <div className="s-pricing-grid">
          <article className="s-price-card">
            <span className="s-price-icon">
              <Zap size={21} aria-hidden="true" />
            </span>
            <h3>Quick Report</h3>
            <p>Get a clear starting point.</p>
            <div className="s-price">
              {usdLabel(quickReport.priceUsd)}
              <span>one time</span>
            </div>
            <Action href="/agent-readiness/buy" secondary>
              Get Quick Report
            </Action>
            <ul>
              <li>
                <Check />
                Fetch-based agent readiness
              </li>
              <li>
                <Check />
                Evidence and prioritized fixes
              </li>
              <li>
                <Check />
                Formatted report, emailed to you
              </li>
              <li>
                <Check />
                No account or subscription
              </li>
            </ul>
          </article>
          <article className="s-price-card featured">
            <span className="s-price-featured-label">THE DEEPER PICTURE</span>
            <span className="s-price-icon">
              <ScanLine size={21} aria-hidden="true" />
            </span>
            <h3>Deep Report</h3>
            <p>See what a real browser sees.</p>
            <div className="s-price">
              {usdLabel(deepReport.priceUsd)}
              <span>one time</span>
            </div>
            <Action href="/agent-readiness/buy?tier=deep">
              Get Deep Report
            </Action>
            <ul>
              <li>
                <Check />
                Browser-rendered intelligence
              </li>
              <li>
                <Check />
                Lighthouse and axe-core findings
              </li>
              <li>
                <Check />
                Screenshots and network evidence
              </li>
              <li>
                <Check />
                Formatted, emailed, and verifiable
              </li>
            </ul>
          </article>
          <article className="s-price-card">
            <span className="s-price-icon">
              <Activity size={21} aria-hidden="true" />
            </span>
            <h3>Monitoring</h3>
            <p>Stay ahead of what changes.</p>
            <div className="s-price">
              {usdLabel(monitoring.priceUsd)}
              <span>/ month</span>
            </div>
            <Action href="/monitoring" secondary>
              Start monitoring
            </Action>
            <ul>
              <li>
                <Check />
                One URL, re-audited weekly
              </li>
              <li>
                <Check />
                Alerts for changes of 5+ points
              </li>
              <li>
                <Check />
                Monthly progress digest
              </li>
              <li>
                <Check />
                Cancel anytime
              </li>
            </ul>
          </article>
        </div>
        <div className="s-api-pricing">
          <span>
            <Code2 size={20} aria-hidden="true" />
            <strong>Building for agents?</strong> Pay per API call in USDC on
            Base.
          </span>
          <a href="/pricing" data-analytics-event="pricing_api_tab_opened">
            Explore all {PAID_CAPABILITY_COUNT} capabilities{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="s-founder" id="about">
        <div className="s-founder-identity">
          <Image
            src="/assets/santos-portrait.png"
            alt="Juan Santos, founder of Santos Automation"
            width={64}
            height={64}
          />
          <div>
            <strong>Juan Santos</strong>
            <span>Founder &amp; engineer</span>
          </div>
        </div>
        <p>When you contact Santos, you reach the person who wrote the code.</p>
        <a className="s-text-link" href="mailto:info@santosautomation.com">
          Let’s talk <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </section>

      <section className="s-section s-faq-section" id="faq">
        <SectionHeading
          label="A LITTLE MORE CLARITY"
          title={
            <>
              Good questions.
              <br />
              Straight answers.
            </>
          }
        >
          Need something specific?{" "}
          <a href="mailto:info@santosautomation.com">Ask the builder.</a>
        </SectionHeading>
        <div className="s-faq-list">
          {FAQS.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="s-final-cta" id="get-started">
        <div className="final-cta-emblem" aria-hidden="true">
          <Image src="/assets/santos-eagle.svg" alt="" width={76} height={76} />
        </div>
        <p className="s-eyebrow">THE NEXT WEB IS ALREADY HERE</p>
        <h2>
          Make sure you’re
          <br />
          <em>part of it.</em>
        </h2>
        <p>Know where you stand. Know what to fix next.</p>
        <div className="s-hero-actions">
          <Action href="/agent-readiness/buy">Get your website report</Action>
          <Action href="/reports" secondary>
            Explore real reports
          </Action>
        </div>
        <span>No account needed. Just a better understanding.</span>
      </section>
    </PageShell>
  );
}
