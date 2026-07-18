import AuditWidget from "../AuditWidget.js";
import { PageShell } from "./SiteChrome.js";
import StructuredData from "./StructuredData.js";
import { SITE_URL } from "../../lib/marketing-content.js";

export default function MarketingPage({ page, showAudit = false }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["WebAPI", "Service"],
        "@id": `${SITE_URL}${page.path}#service`,
        name: page.h1,
        description: page.description,
        url: `${SITE_URL}${page.path}`,
        documentation: "https://api.santosautomation.com/openapi.json",
        serviceType: "AI Website Intelligence API",
        provider: { "@type": "Organization", name: "Santos Automation", url: SITE_URL },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: page.h1, item: `${SITE_URL}${page.path}` },
        ],
      },
      ...(page.faq?.length ? [{
        "@type": "FAQPage",
        mainEntity: page.faq.map(({ question, answer }) => ({
          "@type": "Question", name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }] : []),
    ],
  };

  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="marketing-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>{page.h1}</span></div>
        <header className="page-hero">
          <p className="kicker">{page.eyebrow}</p>
          <h1>{page.h1}</h1>
          <p className="lede">{page.intro}</p>
          <div className="cta-row">
            <a className="btn primary" href={showAudit ? "#run-audit" : "/agent-readiness-audit#run-audit"} data-analytics-event="primary_cta_clicked">Run an Agent Readiness Audit</a>
            <a className="btn" href="/openapi.json" data-analytics-event="api_documentation_viewed">Explore the API</a>
          </div>
        </header>

        {showAudit && <section id="run-audit" className="content-section"><h2>Start with a free Quick Intelligence scan</h2><p className="sub">Use the live entry point to inspect the report shape. The complete Agent Readiness endpoint costs 0.025 USDC per successful audit.</p><div className="audit-box"><AuditWidget /></div></section>}

        {page.highlights?.length > 0 && <section className="content-section"><h2>What the assessment covers</h2><div className="feature-grid">{page.highlights.map((item) => <div className="feature-card" key={item.name}><h3>{item.name}</h3><p>{item.text}</p></div>)}</div></section>}

        <section className="content-section prose-grid">
          {page.sections.map((section) => <div key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></div>)}
        </section>

        {page.code && <section className="content-section"><h2>Interface example</h2><pre className="code-sample"><code>{page.code}</code></pre></section>}

        {page.faq?.length > 0 && <section className="content-section"><h2>Frequently asked questions</h2><div className="faq-list">{page.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>}

        <section className="content-section related"><h2>Continue evaluating</h2><div className="related-links">{page.related.map(([label, href]) => <a href={href} key={href}>{label}<span aria-hidden="true"> →</span></a>)}</div></section>
      </article>
    </PageShell>
  );
}
