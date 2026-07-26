// Page Link Map product engine: one HTML page URL in → categorized link map out.
// Fetches through the same SSRF-guarded safe-fetcher as /v1/fetch, then
// resolves, dedupes, and categorizes every <a href> on the page.
import * as cheerio from "cheerio";
import { fetchUrl } from "./fetch-product.js";
import { AuditError } from "./safe-fetch.js";

export const LINKS_SCHEMA_VERSION = "1.0.0";
const MAX_LINKS = 200;
const MAX_TEXT_CHARS = 120;

const SKIP_SCHEMES = /^(javascript|mailto|tel):/i;
const SOCIAL_HOSTS = new Set([
  "twitter.com", "x.com", "github.com", "linkedin.com",
  "youtube.com", "discord.com", "discord.gg",
]);
const PATH_TOPICS = [
  ["docs", /\/(docs|documentation|developers)(\/|$)/i],
  ["pricing", /\/(pricing|plans|billing)(\/|$)/i],
  ["api", /\/(api|openapi|swagger)(\/|$)/i],
  ["careers", /\/(careers|jobs)(\/|$)/i],
];
const FEED_PATH = /(\.xml$|\/(rss|atom|feed)(\/|$|\.))/i;

function hostOf(url) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

function topicsFor(url) {
  const topics = [];
  const host = hostOf(url);
  if (SOCIAL_HOSTS.has(host) || [...SOCIAL_HOSTS].some((h) => host.endsWith(`.${h}`))) {
    topics.push("social");
  }
  for (const [topic, pattern] of PATH_TOPICS) {
    if (pattern.test(url.pathname)) topics.push(topic);
  }
  if (FEED_PATH.test(url.pathname)) topics.push("feed");
  return topics;
}

// Pure extractor, exported for tests: HTML + final URL in, link list out.
export function extractLinks(html, finalUrl) {
  const $ = cheerio.load(html);
  const base = new URL(finalUrl);
  const seen = new Set();
  const links = [];
  $("a[href]").each((_, el) => {
    if (links.length >= MAX_LINKS) return false;
    const href = String($(el).attr("href") ?? "").trim();
    if (!href || SKIP_SCHEMES.test(href)) return undefined;
    let resolved;
    try {
      resolved = new URL(href, base);
    } catch {
      return undefined; // unparseable href — skip
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return undefined;
    resolved.hash = ""; // fragments don't make a distinct link
    const key = resolved.href;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const text = String($(el).text() ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
    links.push({
      url: key,
      text,
      kind: hostOf(resolved) === hostOf(base) ? "internal" : "external",
      topics: topicsFor(resolved),
    });
    return undefined;
  });
  return links;
}

// Pure response shaper, exported for tests. Non-HTML targets are not mappable.
export function shapeLinksResponse(fetchResult, requestedUrl) {
  const contentType = fetchResult.content_type ?? "";
  if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
    throw new AuditError("NOT_HTML", `URL did not return an HTML page (content type: ${contentType.split(";")[0] || "unknown"})`);
  }
  const links = extractLinks(fetchResult.body, fetchResult.final_url);
  const counts = { internal: 0, external: 0, docs: 0, pricing: 0, api: 0, careers: 0, social: 0, feed: 0 };
  for (const link of links) {
    counts[link.kind] += 1;
    for (const topic of link.topics) counts[topic] += 1;
  }
  return {
    schema_version: LINKS_SCHEMA_VERSION,
    url: requestedUrl,
    final_url: fetchResult.final_url,
    http_status: fetchResult.http_status,
    total_links: links.length,
    counts,
    links,
  };
}

export async function mapLinks(rawUrl) {
  const result = await fetchUrl(rawUrl);
  return shapeLinksResponse(result, rawUrl);
}
