import test from "node:test";
import assert from "node:assert/strict";
import { parseFeedBody, FEED_SCHEMA_VERSION } from "../lib/feed.js";
import { AuditError } from "../lib/safe-fetch.js";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <description>All the examples</description>
    <item>
      <title>Post One</title>
      <link>https://example.com/one</link>
      <guid>urn:post:1</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <description>&lt;p&gt;First &lt;b&gt;post&lt;/b&gt;&lt;/p&gt;</description>
      <author>alice@example.com (Alice)</author>
    </item>
    <item>
      <title>Post Two</title>
      <link>https://example.com/two</link>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
      <description>Second post</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <link rel="alternate" href="https://example.com/"/>
  <subtitle>Atom subtitle</subtitle>
  <entry>
    <title>Entry One</title>
    <link href="https://example.com/e1"/>
    <id>urn:entry:1</id>
    <published>2024-01-01T00:00:00Z</published>
    <summary>Entry summary</summary>
    <author><name>Bob</name></author>
  </entry>
</feed>`;

const JSON_FEED = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  title: "JSON Blog",
  home_page_url: "https://example.com",
  feed_url: "https://example.com/feed.json",
  items: [
    {
      id: "1",
      title: "Item 1",
      url: "https://example.com/1",
      date_published: "2024-01-01T00:00:00Z",
      content_text: "hello world",
      author: { name: "Carol" },
    },
  ],
});

test("parses RSS 2.0 with normalized items", () => {
  const r = parseFeedBody(RSS, "application/rss+xml; charset=utf-8", "https://example.com/feed.xml", "https://example.com/feed.xml");
  assert.equal(r.schema_version, FEED_SCHEMA_VERSION);
  assert.equal(r.format, "rss2");
  assert.deepEqual(r.feed, {
    title: "Example Blog",
    link: "https://example.com",
    description: "All the examples",
    feed_url: "https://example.com/feed.xml",
  });
  assert.equal(r.item_count, 2);
  assert.deepEqual(r.items[0], {
    id: "urn:post:1",
    title: "Post One",
    url: "https://example.com/one",
    published: "Mon, 01 Jan 2024 00:00:00 GMT",
    summary: "First post", // embedded HTML stripped
    author: "alice@example.com (Alice)",
  });
  assert.equal(r.items[1].id, "https://example.com/two"); // falls back to link
  assert.equal(r.items[1].author, null); // null-safe
});

test("parses Atom with normalized items", () => {
  const r = parseFeedBody(ATOM, "application/atom+xml", "https://example.com/atom.xml", "https://example.com/atom.xml");
  assert.equal(r.format, "atom");
  assert.equal(r.feed.title, "Atom Blog");
  assert.equal(r.feed.link, "https://example.com/");
  assert.equal(r.feed.description, "Atom subtitle");
  assert.equal(r.item_count, 1);
  assert.deepEqual(r.items[0], {
    id: "urn:entry:1",
    title: "Entry One",
    url: "https://example.com/e1",
    published: "2024-01-01T00:00:00Z",
    summary: "Entry summary",
    author: "Bob",
  });
});

test("parses JSON Feed", () => {
  const r = parseFeedBody(JSON_FEED, "application/feed+json", "https://example.com/feed.json", "https://example.com/feed.json");
  assert.equal(r.format, "json");
  assert.equal(r.feed.title, "JSON Blog");
  assert.equal(r.feed.link, "https://example.com");
  assert.equal(r.feed.feed_url, "https://example.com/feed.json");
  assert.equal(r.item_count, 1);
  assert.deepEqual(r.items[0], {
    id: "1",
    title: "Item 1",
    url: "https://example.com/1",
    published: "2024-01-01T00:00:00Z",
    summary: "hello world",
    author: "Carol",
  });
});

test("caps items at 50", () => {
  const big = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Big",
    items: Array.from({ length: 60 }, (_, i) => ({ id: String(i), title: `Item ${i}` })),
  });
  const r = parseFeedBody(big, "application/json", "https://example.com/feed.json", "https://example.com/feed.json");
  assert.equal(r.item_count, 50);
  assert.equal(r.items.length, 50);
  assert.equal(r.items[49].id, "49");
});

test("caps summaries at 500 chars", () => {
  const long = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Long",
    items: [{ id: "1", content_text: "x".repeat(600) }],
  });
  const r = parseFeedBody(long, "application/json", "https://example.com/feed.json", "https://example.com/feed.json");
  assert.equal(r.items[0].summary.length, 500);
});

test("non-feed content throws AuditError NOT_A_FEED", () => {
  for (const [body, type] of [
    ["<html><body>Not a feed</body></html>", "text/html"],
    [JSON.stringify({ hello: "world" }), "application/json"],
    ["{not valid json", "application/json"],
  ]) {
    assert.throws(
      () => parseFeedBody(body, type, "https://example.com", "https://example.com"),
      (e) => e instanceof AuditError && e.code === "NOT_A_FEED"
    );
  }
});
