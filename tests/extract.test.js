import test from "node:test";
import assert from "node:assert/strict";
import { extractFromHtml } from "../lib/extract.js";

const ARTICLE = `<!doctype html><html><head>
<title>Widget Review — Example</title>
<meta name="description" content="An in-depth widget review.">
<link rel="canonical" href="https://example.com/widget-review">
<script>alert("never in output")</script>
<style>.x{color:red}</style>
</head><body>
<nav><a href="/home">Home</a><a href="/about">About</a></nav>
<article>
<h1>Widget Review</h1>
<p>The widget performed admirably across every benchmark we threw at it. This
paragraph exists to provide enough content for readability to treat this page
as an article rather than a navigation shell, so it keeps going with detail
about materials, build quality, battery life, and long-term durability that a
reader would genuinely care about when comparing widgets.</p>
<p>See the <a href="/methodology">methodology</a> and the
<a href="https://other.example.org/spec#frag">official spec</a>.</p>
</article>
<footer><a href="/terms">Terms</a></footer>
</body></html>`;

test("extracts title, description, canonical from an article page", () => {
  const r = extractFromHtml(ARTICLE, "https://example.com/widget-review");
  assert.equal(r.title, "Widget Review — Example");
  assert.equal(r.description, "An in-depth widget review.");
  assert.equal(r.canonical_url, "https://example.com/widget-review");
});

test("markdown contains content and never scripts or styles", () => {
  const r = extractFromHtml(ARTICLE, "https://example.com/widget-review");
  // Readability lifts the H1 into the title field rather than the body.
  assert.match(r.title, /Widget Review/);
  assert.match(r.markdown, /performed admirably/);
  assert.doesNotMatch(r.markdown, /alert\(/);
  assert.doesNotMatch(r.markdown, /color:red/);
  assert.ok(r.word_count > 20);
});

test("links are absolute, deduped, hash-stripped", () => {
  const r = extractFromHtml(ARTICLE, "https://example.com/widget-review");
  const urls = r.links.map((l) => l.url);
  assert.ok(urls.includes("https://example.com/methodology"));
  assert.ok(urls.includes("https://other.example.org/spec"));
  assert.equal(new Set(urls).size, urls.length);
});

test("non-article page falls back to stripped body markdown", () => {
  const html = `<html><head><title>Links</title></head><body>
    <nav><a href="/skip">skip</a></nav><p>tiny</p><script>x()</script></body></html>`;
  const r = extractFromHtml(html, "https://example.com/");
  assert.match(r.markdown, /tiny/);
  assert.doesNotMatch(r.markdown, /x\(\)/);
});

test("text/plain passes through as markdown", () => {
  const r = extractFromHtml("plain body text", "https://example.com/a.txt", "text/plain");
  assert.equal(r.markdown, "plain body text");
  assert.equal(r.word_count, 3);
  assert.equal(r.title, null);
});
