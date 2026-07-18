// Site audit engine: fetches a URL, scores performance/SEO/accessibility signals.
// Zero heavy deps — fetch + cheerio. Returns structured JSON agents can consume.
import * as cheerio from "cheerio";
import { safeFetch } from "./lib/safe-fetch.js";
import { auditAgentReadiness } from "./lib/agent-readiness/analyze.js";
import { websiteIntelligenceSummary } from "./lib/website-intelligence.js";

const UA = "SantosAuditBot/0.1 (+https://santosautomation.com)";

export async function auditSite(rawUrl) {
  const { response: res, body: html, finalUrl: url, ttfbMs, totalMs } = await safeFetch(rawUrl, { "user-agent": UA });
  const $ = cheerio.load(html);

  // ---- signal collection ----
  const imgs = $("img");
  const imgsMissingAlt = imgs.filter((_, el) => !$(el).attr("alt")?.trim()).length;
  const title = $("title").text().trim();
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  const h1Count = $("h1").length;
  const viewport = !!$('meta[name="viewport"]').attr("content");
  const canonical = !!$('link[rel="canonical"]').attr("href");
  const ogTags = $('meta[property^="og:"]').length;
  const scripts = $("script[src]").length;
  const stylesheets = $('link[rel="stylesheet"]').length;
  const htmlKb = Math.round(Buffer.byteLength(html) / 1024);
  const https = url.startsWith("https://");
  const lang = !!$("html").attr("lang");

  const checks = {
    performance: [
      rule(ttfbMs < 800, `TTFB ${ttfbMs}ms`, "Server response over 800ms — consider caching/CDN"),
      rule(htmlKb < 300, `HTML weight ${htmlKb}KB`, `HTML is ${htmlKb}KB — trim markup or lazy-load`),
      rule(scripts <= 15, `${scripts} external scripts`, `${scripts} external scripts — audit and defer`),
      rule(stylesheets <= 6, `${stylesheets} stylesheets`, `${stylesheets} stylesheets — consolidate`),
    ],
    seo: [
      rule(title.length >= 10 && title.length <= 65, `Title (${title.length} chars)`, title ? `Title length ${title.length} — aim for 10–65 chars` : "Missing <title>"),
      rule(metaDesc.length >= 50 && metaDesc.length <= 160, "Meta description present", metaDesc ? `Meta description ${metaDesc.length} chars — aim for 50–160` : "Missing meta description"),
      rule(h1Count === 1, "Single H1", h1Count === 0 ? "No H1 found" : `${h1Count} H1s — use exactly one`),
      rule(canonical, "Canonical URL set", "Missing canonical link"),
      rule(ogTags >= 3, `${ogTags} OpenGraph tags`, "Sparse OpenGraph tags — link previews will look bare"),
    ],
    accessibility: [
      rule(imgsMissingAlt === 0, `All ${imgs.length} images have alt text`, `${imgsMissingAlt}/${imgs.length} images missing alt text`),
      rule(lang, "html[lang] set", "Missing lang attribute on <html>"),
      rule(viewport, "Mobile viewport meta", "Missing viewport meta — mobile rendering will break"),
    ],
    security: [
      rule(https, "Serves over HTTPS", "Not HTTPS"),
      rule(!!res.headers.get("strict-transport-security"), "HSTS header", "Missing Strict-Transport-Security header"),
      rule(!!res.headers.get("content-security-policy"), "CSP header", "Missing Content-Security-Policy header"),
    ],
  };

  const scores = Object.fromEntries(
    Object.entries(checks).map(([cat, rules]) => [
      cat, Math.round((rules.filter(r => r.pass).length / rules.length) * 100),
    ])
  );
  const overall = quickOverallScore(scores);
  // Additive only: this assessment never changes the established Quick Audit
  // category or overall scores and performs no additional network requests.
  const agentReadiness = process.env.AGENT_READINESS_ENABLED === "false" ? undefined :
    await auditAgentReadiness(rawUrl, {
      mode: "embedded",
      maxFetches: 0,
      existingPage: {
        body: html,
        finalUrl: url,
        status: res.status,
        headers: res.headers,
      },
    });

  const websiteIntelligence = websiteIntelligenceSummary({ scores, agentReadiness });

  return {
    schema_version: "2.1.0",
    url, fetched_at: new Date().toISOString(),
    http_status: res.status, timing_ms: { ttfb: ttfbMs, total: totalMs },
    overall_score: overall, scores, checks,
    website_intelligence_score: websiteIntelligence.score,
    website_intelligence: websiteIntelligence,
    issues: Object.values(checks).flat().filter(r => !r.pass).map(r => r.fix),
    ...(agentReadiness ? { agent_readiness: agentReadiness } : {}),
    audited_by: "Santos Automation — santosautomation.com",
  };
}

const rule = (pass, ok, fix) => ({ pass, detail: pass ? ok : fix, ...(pass ? {} : { fix }) });

export function quickOverallScore(scores) {
  const historical = ["performance", "seo", "accessibility", "security"];
  return Math.round(historical.reduce((sum, key) => sum + scores[key], 0) / historical.length);
}
