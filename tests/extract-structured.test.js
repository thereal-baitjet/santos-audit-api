import test from "node:test";
import assert from "node:assert/strict";
import { AuditError } from "../lib/safe-fetch.js";
import {
  compileExtractionSchema,
  truncateForModel,
  assertValidExtraction,
  MAX_SCHEMA_CHARS,
  MAX_CONTENT_CHARS,
} from "../lib/extract-structured.js";

function assertInvalidSchema(schema) {
  assert.throws(
    () => compileExtractionSchema(schema),
    (e) => e instanceof AuditError && e.code === "INVALID_EXTRACTION_SCHEMA"
  );
}

test("schema validation: rejects non-object top-level schemas before any fetch", () => {
  assertInvalidSchema("a string, not a schema");
  assertInvalidSchema(42);
  assertInvalidSchema(null);
  assertInvalidSchema(["type", "object"]); // array, not an object
  assertInvalidSchema({ type: "array", items: { type: "string" } }); // valid JSON Schema, wrong top-level type
});

test("schema validation: rejects an oversized schema", () => {
  const properties = {};
  for (let i = 0; i < 400; i++) {
    properties[`field_${i}`] = { type: "string", description: "padding to exceed the character cap" };
  }
  const oversized = { type: "object", properties };
  assert.ok(JSON.stringify(oversized).length > MAX_SCHEMA_CHARS);
  assertInvalidSchema(oversized);
});

test("schema validation: rejects a schema that fails to compile", () => {
  // "type" must be a string or array of strings per JSON Schema — this throws inside ajv.compile.
  assertInvalidSchema({ type: "object", properties: { x: { type: 123 } } });
});

test("schema validation: rejects any schema containing $ref, even self-contained $defs", () => {
  assertInvalidSchema({
    type: "object",
    properties: { x: { $ref: "#/$defs/thing" } },
    $defs: { thing: { type: "string" } },
  });
  assertInvalidSchema({ type: "object", allOf: [{ $ref: "https://example.com/external-schema.json" }] });
});

test("schema validation: accepts a well-formed, self-contained object schema", () => {
  const validate = compileExtractionSchema({
    type: "object",
    required: ["price", "in_stock"],
    properties: { price: { type: "number" }, in_stock: { type: "boolean" } },
  });
  assert.equal(typeof validate, "function");
});

test("content truncation: leaves short content untouched", () => {
  const short = "well under the cap";
  assert.equal(truncateForModel(short), short);
});

test("content truncation: truncates exactly at the 8000-char cap", () => {
  const long = "x".repeat(MAX_CONTENT_CHARS + 5000);
  const truncated = truncateForModel(long);
  assert.equal(truncated.length, MAX_CONTENT_CHARS);
  assert.equal(truncated, "x".repeat(MAX_CONTENT_CHARS));
});

test("content truncation: handles missing/undefined markdown", () => {
  assert.equal(truncateForModel(undefined), "");
});

test("output validation: a schema-conforming fake Claude output passes", () => {
  const validate = compileExtractionSchema({
    type: "object",
    required: ["price", "in_stock"],
    properties: { price: { type: "number" }, in_stock: { type: "boolean" } },
  });
  const fakeToolUse = { type: "tool_use", name: "extract", input: { price: 49.99, in_stock: true } };
  const data = assertValidExtraction(validate, fakeToolUse);
  assert.deepEqual(data, { price: 49.99, in_stock: true });
});

test("output validation: STRUCTURED_OUTPUT_INVALID fires when the fake output violates the schema", () => {
  const validate = compileExtractionSchema({
    type: "object",
    required: ["price", "in_stock"],
    properties: { price: { type: "number" }, in_stock: { type: "boolean" } },
  });
  const fakeToolUse = { type: "tool_use", name: "extract", input: { price: "not a number", in_stock: true } };
  assert.throws(
    () => assertValidExtraction(validate, fakeToolUse),
    (e) => e instanceof AuditError && e.code === "STRUCTURED_OUTPUT_INVALID"
  );
});

test("output validation: STRUCTURED_OUTPUT_INVALID fires when Claude returns no tool call at all", () => {
  const validate = compileExtractionSchema({ type: "object", properties: { x: { type: "string" } } });
  assert.throws(
    () => assertValidExtraction(validate, undefined),
    (e) => e instanceof AuditError && e.code === "STRUCTURED_OUTPUT_INVALID"
  );
});
