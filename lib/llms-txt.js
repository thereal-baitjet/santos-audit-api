// Free llms.txt draft generator (Phase C). Fetches ONE public page through the
// SSRF-guarded safe-fetcher, cheerio-extracts orientation signals (title, meta
// description, h1/h2 outline, same-origin internal links), and emits a draft
// llms.txt following the llmstxt.org convention:
//
//   # <site name>
//   > <summary>
//   <optional details>
//   ## <Section>
//   - [text](url): optional note
//
// The output is a DRAFT — one page is a thin sample of a site, so the response
// always carries notes telling the caller to review before publishing.
//
// buildLlmsTxt is pure (html + url in, markdown out) so it can be unit-tested
// without the network; generateLlmsTxt is the network wrapper the route calls.
import * as cheerio from "cheerio";
import { safeFetch } from "./safe-fetch.js";

const MAX_LINKS = 20;

const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

// Skip schemes and anchor-only hrefs that are never useful in an llms.txt.
const SKIP_HREF = /^(#|mailto:|tel:|javascript:)/i;

function extractInternalLinks($, baseUrl) {
  const origin = baseUrl.origin;
  const seen = new Set();
  const links = [];
  $("a[href]").each((_, el) => {
    if (links.length >= MAX_LINKS) return false;
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || SKIP_HREF.test(href)) return;
    let resolved;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (resolved.origin !== origin) return;
    resolved.hash = ""; // same page, different anchor = one entry
    const url = resolved.href;
    if (seen.has(url)) return;
    seen.add(url);
    const text = clean($(el).text()) || resolved.pathname.replace(/\/+$/, "").split("/").pop() || resolved.hostname;
    links.push({ text, url });
  });
  return links;
}

function extractOutline($) {
  const outline = [];
  $("h1, h2").each((_, el) => {
    const text = clean($(el).text());
    if (text) outline.push({ level: el.tagName.toLowerCase(), text });
  });
  return outline.slice(0, 30);
}

// Pure: build the draft llms.txt markdown from already-fetched HTML.
// Returns { llms_txt, notes }.
export function buildLlmsTxt({ html, url }) {
  const baseUrl = new URL(url);
  const $ = cheerio.load(html);
  const notes = ["Draft — review before publishing", "1 page sampled"];

  const title = clean($("title").first().text());
  const siteName =
    clean($('meta[property="og:site_name"]').attr("content")) ||
    title ||
    baseUrl.hostname;
  if (!title) notes.push("No <title> found — used the hostname as the site name");

  const summary =
    clean($('meta[name="description"]').attr("content")) ||
    clean($('meta[property="og:description"]').attr("content"));
  if (!summary) notes.push("No meta description found — write the > summary yourself");

  const outline = extractOutline($);
  const links = extractInternalLinks($, baseUrl);
  if (links.length === 0) notes.push("No same-origin internal links found on the sampled page");

  const lines = [`# ${siteName}`, ""];
  if (summary) lines.push(`> ${summary}`, "");

  // Convention allows freeform details (no heading) after the summary
  // blockquote — the h1/h2 outline is the most useful orientation we have.
  if (outline.length > 0) {
    lines.push("Content outline of the sampled page:", "");
    for (const item of outline) {
      lines.push(`${item.level === "h2" ? "  " : ""}- ${item.text}`);
    }
    lines.push("");
  }

  if (links.length > 0) {
    lines.push("## Pages", "");
    for (const link of links) lines.push(`- [${link.text}](${link.url})`);
    lines.push("");
  }

  return { llms_txt: lines.join("\n").trimEnd() + "\n", notes };
}

// Network wrapper: SSRF-guarded fetch of one public page, then the pure build.
// Throws AuditError (via safe-fetch) on unreachable/blocked/oversized targets.
export async function generateLlmsTxt(url) {
  const { body, finalUrl } = await safeFetch(url);
  return buildLlmsTxt({ html: body, url: finalUrl });
}
