// Feed Parser product engine: one feed URL in → normalized feed + items out.
// RSS 2.0, Atom, and JSON Feed all normalize to the same shape. Fetching goes
// through the same SSRF-guarded safe-fetcher as /v1/fetch.
import * as cheerio from "cheerio";
import { fetchUrl } from "./fetch-product.js";
import { AuditError } from "./safe-fetch.js";

export const FEED_SCHEMA_VERSION = "1.0.0";
const MAX_ITEMS = 50;
const MAX_SUMMARY_CHARS = 500;

// Null-safe string: collapse whitespace, trim, cap, null when missing/empty.
function clean(value, max = Infinity) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// Feed descriptions often carry embedded HTML — strip tags to plain text.
function stripTags(html) {
  if (!html) return null;
  return clean(cheerio.load(`<div>${html}</div>`).text());
}

function notAFeed(contentType) {
  throw new AuditError(
    "NOT_A_FEED",
    `URL does not appear to be an RSS 2.0, Atom, or JSON feed (content type: ${String(contentType ?? "unknown").split(";")[0]})`
  );
}

function parseRss($, url, finalUrl) {
  const channel = $("channel").first();
  const items = [];
  channel.children("item").each((_, el) => {
    if (items.length >= MAX_ITEMS) return false;
    const item = $(el);
    items.push({
      id: clean(item.children("guid").first().text()) ?? clean(item.children("link").first().text()),
      title: clean(item.children("title").first().text()),
      url: clean(item.children("link").first().text()),
      published: clean(item.children("pubDate").first().text()) ?? clean(item.children("dc\\:date").first().text()),
      summary: clean(stripTags(item.children("description").first().text()), MAX_SUMMARY_CHARS),
      author: clean(item.children("author").first().text()) ?? clean(item.children("dc\\:creator").first().text()),
    });
    return undefined;
  });
  return {
    schema_version: FEED_SCHEMA_VERSION,
    url,
    final_url: finalUrl,
    format: "rss2",
    feed: {
      title: clean(channel.children("title").first().text()),
      link: clean(channel.children("link").first().text()),
      description: clean(stripTags(channel.children("description").first().text())),
      feed_url: finalUrl,
    },
    item_count: items.length,
    items,
  };
}

function parseAtom($, url, finalUrl) {
  const root = $("feed").first();
  const linkOf = (el) =>
    clean(el.children("link[rel='alternate']").first().attr("href")) ??
    clean(el.children("link").first().attr("href"));
  const items = [];
  root.children("entry").each((_, el) => {
    if (items.length >= MAX_ITEMS) return false;
    const entry = $(el);
    items.push({
      id: clean(entry.children("id").first().text()) ?? linkOf(entry),
      title: clean(entry.children("title").first().text()),
      url: linkOf(entry),
      published: clean(entry.children("published").first().text()) ?? clean(entry.children("updated").first().text()),
      summary: clean(
        stripTags(entry.children("summary").first().text()) ?? stripTags(entry.children("content").first().text()),
        MAX_SUMMARY_CHARS
      ),
      author: clean(entry.children("author").first().children("name").first().text()),
    });
    return undefined;
  });
  return {
    schema_version: FEED_SCHEMA_VERSION,
    url,
    final_url: finalUrl,
    format: "atom",
    feed: {
      title: clean(root.children("title").first().text()),
      link: linkOf(root),
      description: clean(stripTags(root.children("subtitle").first().text())),
      feed_url: finalUrl,
    },
    item_count: items.length,
    items,
  };
}

function parseJsonFeed(data, url, finalUrl) {
  const items = (Array.isArray(data.items) ? data.items : []).slice(0, MAX_ITEMS).map((item) => ({
    id: clean(item.id) ?? clean(item.url),
    title: clean(item.title),
    url: clean(item.url) ?? clean(item.external_url),
    published: clean(item.date_published) ?? clean(item.date_modified),
    summary: clean(
      item.summary ?? item.content_text ?? stripTags(item.content_html),
      MAX_SUMMARY_CHARS
    ),
    author: clean(item.author?.name) ?? clean(item.authors?.[0]?.name),
  }));
  return {
    schema_version: FEED_SCHEMA_VERSION,
    url,
    final_url: finalUrl,
    format: "json",
    feed: {
      title: clean(data.title),
      link: clean(data.home_page_url),
      description: clean(data.description),
      feed_url: clean(data.feed_url) ?? finalUrl,
    },
    item_count: items.length,
    items,
  };
}

// Pure parser, exported for tests: body + content type in, normalized feed out.
export function parseFeedBody(body, contentType, url, finalUrl) {
  const trimmed = String(body ?? "").trimStart();
  const looksJson = /json/i.test(contentType ?? "") || trimmed.startsWith("{");
  if (looksJson) {
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      notAFeed(contentType);
    }
    if (typeof data?.version === "string" && data.version.startsWith("https://jsonfeed.org")) {
      return parseJsonFeed(data, url, finalUrl);
    }
    notAFeed(contentType);
  }
  const $ = cheerio.load(body, { xmlMode: true });
  if ($("rss").length && $("channel").length) return parseRss($, url, finalUrl);
  if ($("feed").length) return parseAtom($, url, finalUrl);
  notAFeed(contentType);
}

export async function parseFeed(rawUrl) {
  const result = await fetchUrl(rawUrl);
  return parseFeedBody(result.body, result.content_type, rawUrl, result.final_url);
}
