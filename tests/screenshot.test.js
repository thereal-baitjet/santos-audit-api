import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScreenshotRequest } from "../lib/screenshot.js";

test("defaults: png, desktop, viewport", () => {
  const r = normalizeScreenshotRequest({ url: "https://example.com" });
  assert.deepEqual(r, { profile: "screenshot", url: "https://example.com", format: "png", device: "desktop", full_page: false });
});

test("accepts jpeg/pdf, mobile, full_page string forms", () => {
  const r = normalizeScreenshotRequest({ url: "https://example.com", format: "PDF", device: "Mobile", full_page: "true" });
  assert.equal(r.format, "pdf");
  assert.equal(r.device, "mobile");
  assert.equal(r.full_page, true);
});

test("rejects unknown format and device", () => {
  assert.throws(() => normalizeScreenshotRequest({ url: "https://x.com", format: "gif" }), /format must be/);
  assert.throws(() => normalizeScreenshotRequest({ url: "https://x.com", device: "tablet" }), /device must be/);
});
