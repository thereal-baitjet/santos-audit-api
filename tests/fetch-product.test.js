import test from "node:test";
import assert from "node:assert/strict";
import { shapeFetchResponse, FETCH_CONTENT_TYPES } from "../lib/fetch-product.js";

function fakeResult(headers = {}, body = "{\"ok\":true}") {
  return {
    response: { status: 200, headers: new Headers({ "content-type": "application/json", ...headers }) },
    body,
    finalUrl: "https://example.com/data.json",
    ttfbMs: 12,
    totalMs: 34,
  };
}

test("shapes response with echoed header subset only", () => {
  const r = shapeFetchResponse(fakeResult({ etag: "\"abc\"", "set-cookie": "secret=1" }), "https://example.com/data.json");
  assert.equal(r.http_status, 200);
  assert.equal(r.headers.etag, "\"abc\"");
  assert.equal(r.headers["set-cookie"], undefined); // never echo cookies
  assert.equal(r.body, "{\"ok\":true}");
  assert.equal(r.body_bytes, Buffer.byteLength("{\"ok\":true}"));
  assert.equal(r.timing_ms.ttfb, 12);
});

test("content-type allowlist covers agent formats, blocks binary", () => {
  for (const ok of ["text/html", "application/json", "application/xml", "text/csv", "application/rss+xml", "image/svg+xml", "application/javascript"]) {
    assert.ok(FETCH_CONTENT_TYPES.test(ok), `${ok} should be allowed`);
  }
  for (const bad of ["image/png", "application/pdf", "application/octet-stream", "video/mp4"]) {
    assert.ok(!FETCH_CONTENT_TYPES.test(bad), `${bad} should be blocked`);
  }
});
