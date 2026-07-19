// Page-to-Markdown extraction engine: safe fetch → readability → markdown.
// Read-only, one-shot, single page — same fetch guarantees as the quick audit
// (SSRF guards, 15s timeout, 5MB cap, redirect revalidation via safe-fetch.js).
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { safeFetch } from "./safe-fetch.js";

export const EXTRACT_SCHEMA_VERSION = "1.0.0";
const UA = "SantosExtractBot/1.0 (+https://santosautomation.com)";
const MAX_LINKS = 200;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.remove(["script", "style", "noscript", "template"]);

// Pure HTML→result conversion, exported separately so tests need no network.
export function extractFromHtml(html, pageUrl, contentType = "text/html") {
  if (/text\/plain/i.test(contentType)) {
    const text = html.trim();
    return {
      title: null, byline: null, description: null,
      markdown: text, links: [],
      word_count: text ? text.split(/\s+/).length : 0,
    };
  }

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  const description = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;

  const seen = new Set();
  const links = [];
  $("a[href]").each((_, el) => {
    if (links.length >= MAX_LINKS) return false;
    try {
      const abs = new URL($(el).attr("href"), pageUrl);
      if (!/^https?:$/.test(abs.protocol)) return;
      abs.hash = "";
      if (seen.has(abs.href)) return;
      seen.add(abs.href);
      const text = $(el).text().replace(/\s+/g, " ").trim().slice(0, 200);
      links.push(text ? { url: abs.href, text } : { url: abs.href });
    } catch { /* unparseable href — skip */ }
  });

  // Readability isolates the main content; fall back to a stripped <body> for
  // pages without an article shape (home pages, docs indexes, product pages).
  let article = null;
  try {
    const { document } = parseHTML(html);
    article = new Readability(document, { charThreshold: 250 }).parse();
  } catch { /* malformed DOM — use fallback below */ }

  let markdown;
  if (article?.content) {
    markdown = turndown.turndown(article.content);
  } else {
    $("script, style, noscript, template, svg, iframe, nav, header, footer, form, aside").remove();
    markdown = turndown.turndown($("body").html() ?? "");
  }
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return {
    title: article?.title?.trim() || title,
    byline: article?.byline?.trim() || null,
    description: article?.excerpt?.trim() || description,
    canonical_url: canonical,
    markdown,
    links,
    word_count: markdown ? markdown.split(/\s+/).length : 0,
  };
}

export async function extractPage(rawUrl, { includeLinks = true } = {}) {
  const { response, body, finalUrl, ttfbMs, totalMs } = await safeFetch(rawUrl, {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
  });
  const contentType = response.headers.get("content-type") ?? "text/html";
  const extracted = extractFromHtml(body, finalUrl, contentType);
  if (!includeLinks) delete extracted.links;
  return {
    schema_version: EXTRACT_SCHEMA_VERSION,
    url: rawUrl,
    final_url: finalUrl,
    http_status: response.status,
    ...extracted,
    fetched_at: new Date().toISOString(),
    timing_ms: { ttfb: ttfbMs, total: totalMs },
  };
}
