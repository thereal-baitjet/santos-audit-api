import { PRODUCT_PAGES, LEARN_ARTICLES, SITE_URL } from "../lib/marketing-content.js";

export default function sitemap() {
  // Prerendered at build time — this is the last-deploy date, which is the
  // honest "content last reviewed" signal for the whole marketing surface.
  const now = new Date();
  const paths = [
    "/",
    ...Object.values(PRODUCT_PAGES).map((page) => page.path),
    "/docs",
    "/agent-readiness/run",
    "/agent-readiness/buy",
    "/methodology/agent-readiness",
    "/reports/sample-agent-readiness",
    "/status",
    "/changelog",
    ...Object.keys(LEARN_ARTICLES).map((slug) => `/learn/${slug}`),
    "/terms",
  ];
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path.startsWith("/learn/") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path === "/ai-website-intelligence" || path === "/docs" ? 0.9 : 0.7,
  }));
}
