import { PageShell } from "../../components/SiteChrome.js";
import StructuredData from "../../components/StructuredData.js";
import { SITE_URL } from "../../../lib/marketing-content.js";

const path = "/methodology/agent-readiness";
export const metadata = {
  title: "AI Agent Readiness Scoring Methodology | Santos",
  description: "How Santos classifies websites, applies Agent Readiness checks, calculates weighted scores and coverage, records evidence, and reports limitations.",
  alternates: { canonical: path },
  openGraph: { title: "AI Agent Readiness Scoring Methodology | Santos", description: "Public scoring, applicability, evidence, and limitations for Santos Agent Readiness.", type: "article", url: path },
  twitter: { card: "summary_large_image", title: "AI Agent Readiness Scoring Methodology | Santos", description: "Public scoring, applicability, evidence, and limitations." },
};

const categories = [
  ["Discovery & documentation", "20%", "llms.txt, interface links, machine-readable docs, and crawlability"],
  ["Structured identity & context", "15%", "parseable JSON-LD, provider identity, WebAPI and Offer data, and claim consistency"],
  ["API readiness", "20%", "OpenAPI discovery, validity, operations, schemas, access, and capability manifests"],
  ["MCP readiness", "25%", "advertising, registry evidence, transport, tools, outputs, authorization, and safety"],
  ["Operational trust", "10%", "HTTPS, contact, terms, privacy, errors, limits, and accurate claims"],
  ["Agent commerce", "10%", "applicability, pricing discovery, unsigned challenges, idempotency, settlement, and receipts"],
];

export default function MethodologyPage() {
  const jsonLd = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "TechArticle", headline: metadata.title, description: metadata.description, url: `${SITE_URL}${path}`, datePublished: "2026-07-18", dateModified: "2026-07-18", author: { "@type": "Person", name: "Juan Santos" }, publisher: { "@type": "Organization", name: "Santos Automation", url: SITE_URL } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "Methodology", item: `${SITE_URL}${path}` }] },
    ],
  };
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="article-page methodology-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Methodology</span><span aria-hidden="true">/</span><span>Agent Readiness</span></div>
        <header className="page-hero"><p className="kicker">Versioned methodology · 1.0.0</p><h1>How Santos measures Agent Readiness</h1><p className="lede">A passive, evidence-based assessment of whether agents can discover, understand, select, invoke, and—when applicable—transact with a public website or service.</p><p className="byline">Published and reviewed 2026-07-18</p></header>
        <section className="content-section"><h2>Classification before scoring</h2><p className="sub wide">Santos classifies a target as a general website, documentation site, API provider, MCP provider, or agent-commerce provider. API, MCP, and commerce categories can be marked not applicable. Their absence does not lower the score of a site that does not claim to expose callable services.</p></section>
        <section className="content-section"><h2>Category weights</h2><div className="table-wrap"><table><thead><tr><th>Category</th><th>Weight</th><th>Observed evidence</th></tr></thead><tbody>{categories.map(([name, weight, checks]) => <tr key={name}><th scope="row">{name}</th><td>{weight}</td><td>{checks}</td></tr>)}</tbody></table></div></section>
        <section className="content-section prose-grid"><div><h2>Pass, fail, unknown, or not applicable</h2><p>Only executed pass and fail findings contribute to a category subscore. Unknown evidence remains visible and reduces tested coverage. Not-applicable checks are excluded from the denominator.</p></div><div><h2>Weighted, deterministic scoring</h2><p>Each check has a published internal weight. Category scores reflect the passed weight among executed checks. The overall readiness score combines applicable category scores using the weights above; no language model changes pass/fail or numeric scores.</p></div><div><h2>Evidence and confidence</h2><p>Findings identify the exact public interface and normalized evidence used. Confidence communicates evidence strength. Recommended actions are ranked from failed checks by impact and expected effort.</p></div><div><h2>Website Intelligence presentation</h2><p>The four Website Intelligence dimensions synthesize completed SEO, accessibility, performance, security, and Agent Readiness categories. Callable is shown as not applicable when API, MCP, and commerce surfaces do not apply. Historical API scores remain unchanged.</p></div></section>
        <section className="content-section callout"><h2>Safety and limitations</h2><ul className="check-list"><li>Public HTTP and HTTPS surfaces only; private and metadata networks are blocked.</li><li>No authentication to or payment of the audited target.</li><li>No form submission, target business-tool invocation, or target code execution.</li><li>llms.txt is treated as a proposal and registry evidence as optional preview infrastructure.</li><li>OpenAPI analysis is structural and bounded; remote schemas are not recursively executed.</li><li>The result is technical evidence, not certification or a guarantee of AI answer visibility.</li></ul></section>
        <section className="content-section related"><h2>Inspect the implementation</h2><div className="related-links"><a href="/reports/sample-agent-readiness">View a sample report →</a><a href="/openapi.json">Read the OpenAPI contract →</a><a href="/agent-readiness/run">Run a paid Agent Readiness audit →</a></div></section>
      </article>
    </PageShell>
  );
}
