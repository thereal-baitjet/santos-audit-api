import { PageShell } from "../../components/SiteChrome.js";
import StructuredData from "../../components/StructuredData.js";
import { SITE_URL } from "../../../lib/marketing-content.js";

const path = "/reports/sample-agent-readiness";
export const metadata = {
  title: "Sample AI Agent Readiness Report | Santos",
  description: "Explore a sanitized Santos Agent Readiness report with Website Intelligence dimensions, applicability, evidence coverage, findings, and prioritized fixes.",
  alternates: { canonical: path },
  openGraph: { title: "Sample AI Agent Readiness Report | Santos", description: "A realistic, sanitized example of Santos Website Intelligence output.", type: "article", url: path },
  twitter: { card: "summary_large_image", title: "Sample AI Agent Readiness Report | Santos", description: "A realistic, sanitized Website Intelligence report." },
};

const sample = `{
  "website_intelligence_score": 82,
  "website_intelligence": {
    "schema_version": "1.0.0",
    "dimensions": {
      "discoverable": 91,
      "understandable": 78,
      "callable": 73,
      "trustworthy": 86
    },
    "coverage": {
      "tests_available": 40,
      "tests_executed": 36,
      "tests_not_applicable": 3,
      "tests_skipped": 1,
      "tested_percent": 90
    }
  },
  "agent_readiness": {
    "schema_version": "1.0.0",
    "profile": "api_provider",
    "score": 79,
    "grade": "C",
    "confidence": 0.91,
    "readiness_level": { "level": 3, "name": "Tool-invokable" }
  }
}`;

export default function SampleReportPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "TechArticle", headline: metadata.title, description: metadata.description, url: `${SITE_URL}${path}`, datePublished: "2026-07-18", dateModified: "2026-07-18", author: { "@type": "Person", name: "Juan Santos" }, publisher: { "@type": "Organization", name: "Santos Automation", url: SITE_URL } };
  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Reports</span><span aria-hidden="true">/</span><span>Sample Agent Readiness</span></div>
        <header className="page-hero"><p className="kicker">Sanitized product output · illustrative target</p><h1>Explore a sample Agent Readiness report</h1><p className="lede">This realistic example demonstrates the report structure without representing a customer, testimonial, certification, or live result. Exact values vary with the target and completed tests.</p><div className="cta-row"><a className="btn primary" href="/agent-readiness-audit#run-audit" data-analytics-event="sample_report_viewed">Run an Agent Readiness Audit</a><a className="btn" href="/methodology/agent-readiness">Read the scoring rules</a></div></header>
        <section className="content-section"><h2>AI Website Intelligence Score</h2><div className="score-row sample-scores"><div className="score-card"><div className="num good">82</div><div className="lbl">Website Intelligence</div></div><div className="score-card"><div className="num good">91</div><div className="lbl">Discoverable</div></div><div className="score-card"><div className="num warn">78</div><div className="lbl">Understandable</div></div><div className="score-card"><div className="num warn">73</div><div className="lbl">Callable</div></div><div className="score-card"><div className="num good">86</div><div className="lbl">Trustworthy</div></div></div><p className="sub wide">Applicability: API and MCP checks tested · 36 tests executed · 3 not applicable · 1 not tested · 90% weighted evidence coverage · confidence 0.91</p></section>
        <section className="content-section"><h2>Observed evidence</h2><div className="finding-list"><article className="finding pass"><span>Passed</span><h3>OpenAPI document discovered and parsed</h3><p><code>https://example.com/openapi.json</code> returned 200 with a valid 3.1 document, canonical server, stable operation IDs, and typed responses.</p></article><article className="finding warning"><span>Warning</span><h3>MCP was advertised but no public registry record was confirmed</h3><p>The endpoint and transport were documented. Registry evidence is optional preview infrastructure, so this remains a lower-confidence warning.</p></article><article className="finding fail"><span>High priority</span><h3>Machine-readable capability description was incomplete</h3><p>The API was described, but no separate manifest summarized selection guidance, resource-scoped pricing, rate limits, and side effects.</p></article></div></section>
        <section className="content-section"><h2>Prioritized fix</h2><div className="callout"><p><strong>Impact:</strong> high · <strong>Confidence:</strong> high · <strong>Effort:</strong> medium</p><p>Publish a versioned capability manifest that names each callable resource, canonical endpoint, input and output schema, billing unit, price, side effects, errors, limits, support, and terms. Link it from HTML or an HTTP Link header.</p></div></section>
        <section className="content-section"><h2>Sanitized JSON</h2><pre className="code-sample"><code>{sample}</code></pre><p className="sub sub--tight">The production response also preserves established fields such as <code>overall_score</code>, <code>scores</code>, findings, interfaces, and limitations for existing clients.</p></section>
      </article>
    </PageShell>
  );
}
