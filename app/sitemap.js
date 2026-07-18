import { PRODUCT_PAGES, LEARN_ARTICLES, SITE_URL } from "../lib/marketing-content.js";

export default function sitemap() {
  const now = new Date("2026-07-18T00:00:00.000Z");
  const paths = [
    "/",
    ...Object.values(PRODUCT_PAGES).map((page) => page.path),
    "/agent-readiness/run",
    "/methodology/agent-readiness",
    "/reports/sample-agent-readiness",
    ...Object.keys(LEARN_ARTICLES).map((slug) => `/learn/${slug}`),
    "/terms",
  ];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path.startsWith("/learn/") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path === "/ai-website-intelligence" ? 0.9 : 0.7,
  }));
}
