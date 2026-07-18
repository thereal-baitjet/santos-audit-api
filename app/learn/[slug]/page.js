import { notFound } from "next/navigation";
import { PageShell } from "../../components/SiteChrome.js";
import StructuredData from "../../components/StructuredData.js";
import { LEARN_ARTICLES, SITE_URL } from "../../../lib/marketing-content.js";

const REVIEWED = "2026-07-18";

export function generateStaticParams() {
  return Object.keys(LEARN_ARTICLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = LEARN_ARTICLES[slug];
  if (!article) return {};
  const path = `/learn/${slug}`;
  return {
    title: `${article.title} | Santos`, description: article.description,
    alternates: { canonical: path },
    openGraph: { title: article.title, description: article.description, type: "article", url: path },
    twitter: { card: "summary_large_image", title: article.title, description: article.description },
  };
}

export default async function LearnPage({ params }) {
  const { slug } = await params;
  const article = LEARN_ARTICLES[slug];
  if (!article) notFound();
  const path = `/learn/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org", "@graph": [
      {
        "@type": "TechArticle", headline: article.title, description: article.description,
        url: `${SITE_URL}${path}`, datePublished: REVIEWED, dateModified: REVIEWED,
        author: { "@type": "Person", name: "Juan Santos" },
        publisher: { "@type": "Organization", name: "Santos Automation", url: SITE_URL },
      },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE_URL}/learn/what-is-ai-website-intelligence` },
          { "@type": "ListItem", position: 3, name: article.title, item: `${SITE_URL}${path}` },
        ],
      },
    ],
  };

  return (
    <PageShell>
      <StructuredData data={jsonLd} />
      <article className="article-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Learn</span><span aria-hidden="true">/</span><span>{article.title}</span></div>
        <header className="page-hero">
          <p className="kicker">Santos field guide · Agentic web</p>
          <h1>{article.title}</h1>
          <p className="lede">{article.intro}</p>
          <p className="byline">By Juan Santos · Reviewed and updated {REVIEWED}</p>
        </header>
        <div className="article-body">
          {article.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
          <aside className="callout"><h2>Measure the public evidence</h2><p>Run the applicability-aware assessment or inspect the published scoring rules before changing your interface.</p><div className="cta-row"><a className="btn primary" href="/agent-readiness/run">Run Paid Agent Readiness Audit</a><a className="btn" href="/methodology/agent-readiness">Read the methodology</a></div></aside>
          <section><h2>Related reading</h2><ul className="text-links"><li><a href="/ai-website-intelligence">AI Website Intelligence platform guide</a></li><li><a href="/learn/how-ai-agents-discover-capabilities">How agents discover capabilities</a></li><li><a href="/learn/agent-ready-website-checklist">Agent-ready website checklist</a></li></ul></section>
        </div>
      </article>
    </PageShell>
  );
}
