import { notFound } from "next/navigation";
import MarketingPage from "../components/MarketingPage.js";
import { PRODUCT_PAGES, pageMetadata } from "../../lib/marketing-content.js";

export function generateStaticParams() {
  return Object.keys(PRODUCT_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = PRODUCT_PAGES[slug];
  return page ? pageMetadata(page) : {};
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const page = PRODUCT_PAGES[slug];
  if (!page) notFound();
  return <MarketingPage page={page} showAudit={slug === "agent-readiness-audit"} />;
}
