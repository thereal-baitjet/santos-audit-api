import { PRODUCT_PAGES, LEARN_ARTICLES, SITE_URL } from "../lib/marketing-content.js";
import { topPublicReports } from "../lib/public-reports.js";

// Hourly ISR: fresh enough for new leaderboard entries, cached enough that
// crawler polls never hit the database per request.
export const revalidate = 3600;

export default async function sitemap() {
  // Static marketing surface: last-deploy date is the honest "content last
  // reviewed" signal for these pages.
  const now = new Date();
  const paths = [
    "/",
    ...Object.values(PRODUCT_PAGES).map((page) => page.path),
    "/docs",
    "/agent-readiness/run",
    "/agent-readiness/buy",
    "/methodology/agent-readiness",
    "/reports",
    "/reports/sample-agent-readiness",
    "/llms-txt-generator",
    "/ci",
    "/verify",
    "/status",
    "/changelog",
    ...Object.keys(LEARN_ARTICLES).map((slug) => `/learn/${slug}`),
    "/terms",
  ];
  const entries = paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path.startsWith("/learn/") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path === "/ai-website-intelligence" || path === "/docs" ? 0.9 : 0.7,
  }));

  // Dynamic surface: every opted-in public report, so Google can submit each
  // /reports/<domain> directly instead of discovering it via the leaderboard.
  // Fail-safe: a store outage must never 500 the whole sitemap.
  try {
    const reports = await topPublicReports(200);
    for (const row of reports) {
      entries.push({
        url: `${SITE_URL}/reports/${row.domain}`,
        lastModified: row.created_at ? new Date(row.created_at) : now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch (e) {
    console.warn("sitemap: public reports unavailable, serving static entries only:", e.message);
  }

  return entries;
}
