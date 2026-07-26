import test from "node:test";
import assert from "node:assert/strict";
import { extractLinks, shapeLinksResponse, LINKS_SCHEMA_VERSION } from "../lib/links.js";
import { AuditError } from "../lib/safe-fetch.js";

const BASE = "https://example.com/blog/post";

const HTML = `<html><body>
  <a href="/docs/getting-started">  Read the   Docs </a>
  <a href="/docs/getting-started#install">Duplicate with fragment</a>
  <a href="https://other.com/pricing">External Pricing</a>
  <a href="https://twitter.com/example">Twitter</a>
  <a href="relative/page">Relative</a>
  <a href="/feed.xml">Feed</a>
  <a href="javascript:void(0)">JS</a>
  <a href="mailto:x@y.com">Mail</a>
  <a href="tel:+15551234">Phone</a>
  <a>No href</a>
</body></html>`;

test("resolves relative URLs against final_url", () => {
  const links = extractLinks(HTML, BASE);
  const rel = links.find((l) => l.text === "Relative");
  assert.equal(rel.url, "https://example.com/blog/relative/page");
  assert.equal(rel.kind, "internal");
});

test("strips fragments and dedupes, keeping first anchor text", () => {
  const links = extractLinks(HTML, BASE);
  const docs = links.filter((l) => l.url === "https://example.com/docs/getting-started");
  assert.equal(docs.length, 1);
  assert.equal(docs[0].text, "Read the Docs"); // whitespace normalized
  assert.deepEqual(docs[0].topics, ["docs"]);
});

test("skips javascript:, mailto:, tel:, and href-less anchors", () => {
  const links = extractLinks(HTML, BASE);
  assert.equal(links.some((l) => l.url.startsWith("javascript:")), false);
  assert.equal(links.some((l) => l.url.startsWith("mailto:")), false);
  assert.equal(links.some((l) => l.url.startsWith("tel:")), false);
  assert.equal(links.length, 5);
});

test("categorizes kind and topics", () => {
  const links = extractLinks(HTML, BASE);
  const pricing = links.find((l) => l.url === "https://other.com/pricing");
  assert.equal(pricing.kind, "external");
  assert.deepEqual(pricing.topics, ["pricing"]);
  const twitter = links.find((l) => l.url === "https://twitter.com/example");
  assert.equal(twitter.kind, "external");
  assert.deepEqual(twitter.topics, ["social"]);
  const feed = links.find((l) => l.url === "https://example.com/feed.xml");
  assert.equal(feed.kind, "internal");
  assert.deepEqual(feed.topics, ["feed"]);
});

test("caps links at 200", () => {
  const html = Array.from({ length: 250 }, (_, i) => `<a href="/p/${i}">Link ${i}</a>`).join("");
  const links = extractLinks(html, BASE);
  assert.equal(links.length, 200);
});

test("caps anchor text at 120 chars", () => {
  const links = extractLinks(`<a href="/x">${"y".repeat(200)}</a>`, BASE);
  assert.equal(links[0].text.length, 120);
});

function fakeFetchResult(contentType, body = "<html></html>") {
  return {
    body,
    final_url: "https://example.com",
    http_status: 200,
    content_type: contentType,
  };
}

test("shapeLinksResponse builds counts and output shape", () => {
  const r = shapeLinksResponse(fakeFetchResult("text/html; charset=utf-8", HTML), "https://example.com");
  assert.equal(r.schema_version, LINKS_SCHEMA_VERSION);
  assert.equal(r.url, "https://example.com");
  assert.equal(r.final_url, "https://example.com");
  assert.equal(r.http_status, 200);
  assert.equal(r.total_links, r.links.length);
  assert.deepEqual(r.counts, { internal: 3, external: 2, docs: 1, pricing: 1, api: 0, careers: 0, social: 1, feed: 1 });
});

test("non-HTML content type throws AuditError NOT_HTML", () => {
  for (const type of ["application/json", "text/plain", "application/rss+xml"]) {
    assert.throws(
      () => shapeLinksResponse(fakeFetchResult(type), "https://example.com"),
      (e) => e instanceof AuditError && e.code === "NOT_HTML"
    );
  }
});
