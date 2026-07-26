// Tests run the full summarizeUrl pipeline with a mocked fetch and a mocked
// Anthropic client — no network, no API key spend. Pure helpers (request
// builder, output validator, focus normalizer) are tested directly.
import test from "node:test";
import assert from "node:assert/strict";
import { AuditError } from "../lib/safe-fetch.js";
import {
  summarizeUrl,
  buildSummarizeRequest,
  buildSystemPrompt,
  assertValidSummary,
  normalizeFocus,
  SUMMARIZE_TOOL,
  SUMMARIZE_SCHEMA_VERSION,
  MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_FOCUS_CHARS,
  MAX_SUMMARY_WORDS,
} from "../lib/summarize.js";

process.env.ANTHROPIC_API_KEY = "test-key-not-real";

const HTML_PAGE = {
  content_type: "text/html; charset=utf-8",
  final_url: "https://example.com/article",
  http_status: 200,
  body: `<html><head><title>Test Article</title></head><body><article>
    <h1>Test Article</h1>
    <p>${"The quick brown fox jumps over the lazy dog. ".repeat(40)}</p>
  </article></body></html>`,
};

const VALID_OUTPUT = {
  title: "Test Article",
  summary: "A short faithful summary of the page.",
  key_facts: ["fact one", "fact two"],
  entities: ["Example Corp"],
  word_count: 7,
};

function fakeFetch(page = HTML_PAGE) {
  return async () => page;
}

// Mocked Anthropic client: captures the request params and returns a canned
// tool_use response, mirroring the real SDK's messages.create shape.
function fakeClient(toolInput, captured = {}) {
  return () => ({
    messages: {
      create: async (params) => {
        captured.params = params;
        return {
          content: toolInput === null
            ? [{ type: "text", text: "no tool call" }]
            : [{ type: "tool_use", name: "summarize", input: toolInput }],
        };
      },
    },
  });
}

test("pipeline: returns the documented output shape on a successful summary", async () => {
  const result = await summarizeUrl({
    url: "https://example.com/article",
    fetchPage: fakeFetch(),
    createClient: fakeClient(VALID_OUTPUT),
  });
  assert.deepEqual(result, {
    schema_version: SUMMARIZE_SCHEMA_VERSION,
    url: "https://example.com/article",
    final_url: "https://example.com/article",
    http_status: 200,
    title: "Test Article",
    summary: VALID_OUTPUT.summary,
    key_facts: VALID_OUTPUT.key_facts,
    entities: VALID_OUTPUT.entities,
    word_count: 7,
    focus: null,
    model: MODEL,
  });
});

test("tool-use schema enforcement: forced tool choice with the fixed summarize schema", async () => {
  const captured = {};
  await summarizeUrl({
    url: "https://example.com/article",
    fetchPage: fakeFetch(),
    createClient: fakeClient(VALID_OUTPUT, captured),
  });
  const { params } = captured;
  assert.equal(params.model, MODEL);
  assert.equal(params.max_tokens, MAX_OUTPUT_TOKENS);
  assert.deepEqual(params.tool_choice, { type: "tool", name: "summarize" });
  assert.equal(params.tools.length, 1);
  assert.equal(params.tools[0].name, "summarize");
  assert.deepEqual(
    params.tools[0].input_schema.required,
    ["title", "summary", "key_facts", "entities", "word_count"]
  );
  assert.equal(params.tools[0].input_schema.properties.key_facts.maxItems, 10);
  assert.equal(params.tools[0].input_schema.properties.entities.maxItems, 15);
  // untrusted-content guard is present in the system prompt
  assert.match(params.system, /UNTRUSTED DATA/);
});

test("focus passthrough: focus reaches the system prompt and the result; absent otherwise", async () => {
  const withFocus = {};
  const result = await summarizeUrl({
    url: "https://example.com/article",
    focus: "pricing",
    fetchPage: fakeFetch(),
    createClient: fakeClient(VALID_OUTPUT, withFocus),
  });
  assert.equal(result.focus, "pricing");
  assert.match(withFocus.params.system, /prioritize information relevant to this focus: "pricing"/);

  const withoutFocus = {};
  const plain = await summarizeUrl({
    url: "https://example.com/article",
    fetchPage: fakeFetch(),
    createClient: fakeClient(VALID_OUTPUT, withoutFocus),
  });
  assert.equal(plain.focus, null);
  assert.doesNotMatch(withoutFocus.params.system, /prioritize information/);
});

test("non-HTML target: rejects with NOT_HTML before any Claude call", async () => {
  let llmCalled = false;
  await assert.rejects(
    summarizeUrl({
      url: "https://example.com/data.json",
      fetchPage: fakeFetch({ ...HTML_PAGE, content_type: "application/json", body: "{}" }),
      createClient: () => ({ messages: { create: async () => { llmCalled = true; } } }),
    }),
    (e) => e instanceof AuditError && e.code === "NOT_HTML"
  );
  assert.equal(llmCalled, false);
});

test("malformed LLM output: SUMMARY_OUTPUT_INVALID (never settles) on bad shapes", async () => {
  const badOutputs = [
    { ...VALID_OUTPUT, summary: 42 }, // wrong type
    { ...VALID_OUTPUT, summary: "   " }, // empty
    { ...VALID_OUTPUT, title: 7 },
    { ...VALID_OUTPUT, key_facts: "not an array" },
    { ...VALID_OUTPUT, key_facts: ["ok", 5] },
    { ...VALID_OUTPUT, entities: null },
    { ...VALID_OUTPUT, word_count: "seven" },
    { ...VALID_OUTPUT, word_count: -1 },
    "a string, not an object",
    null,
  ];
  for (const bad of badOutputs) {
    await assert.rejects(
      summarizeUrl({
        url: "https://example.com/article",
        fetchPage: fakeFetch(),
        createClient: fakeClient(bad),
      }),
      (e) => e instanceof AuditError && e.code === "SUMMARY_OUTPUT_INVALID"
    );
  }
});

test("malformed LLM output: no tool_use block at all → SUMMARY_OUTPUT_INVALID", async () => {
  await assert.rejects(
    summarizeUrl({
      url: "https://example.com/article",
      fetchPage: fakeFetch(),
      createClient: fakeClient(null),
    }),
    (e) => e instanceof AuditError && e.code === "SUMMARY_OUTPUT_INVALID"
  );
});

test("output validation: summary past the word cap is rejected", () => {
  const toolUse = {
    type: "tool_use",
    name: "summarize",
    input: { ...VALID_OUTPUT, summary: "word ".repeat(MAX_SUMMARY_WORDS + 1).trim() },
  };
  assert.throws(
    () => assertValidSummary(toolUse),
    (e) => e instanceof AuditError && e.code === "SUMMARY_OUTPUT_INVALID"
  );
});

test("output validation: oversized arrays are clamped, empty entries dropped", () => {
  const toolUse = {
    type: "tool_use",
    name: "summarize",
    input: {
      ...VALID_OUTPUT,
      key_facts: Array.from({ length: 14 }, (_, i) => `fact ${i}`),
      entities: [...Array.from({ length: 20 }, (_, i) => `entity ${i}`), "  ", ""],
    },
  };
  const brief = assertValidSummary(toolUse);
  assert.equal(brief.key_facts.length, 10);
  assert.equal(brief.entities.length, 15);
  assert.equal(brief.key_facts[9], "fact 9");
});

test("output validation: null title falls back to the page's own <title>", async () => {
  const result = await summarizeUrl({
    url: "https://example.com/article",
    fetchPage: fakeFetch(),
    createClient: fakeClient({ ...VALID_OUTPUT, title: null }),
  });
  assert.equal(result.title, "Test Article");
});

test("focus validation: non-string or oversized focus is INVALID_FOCUS", () => {
  assert.throws(
    () => normalizeFocus(42),
    (e) => e instanceof AuditError && e.code === "INVALID_FOCUS"
  );
  assert.throws(
    () => normalizeFocus("x".repeat(MAX_FOCUS_CHARS + 1)),
    (e) => e instanceof AuditError && e.code === "INVALID_FOCUS"
  );
  assert.equal(normalizeFocus(undefined), null);
  assert.equal(normalizeFocus("   "), null);
  assert.equal(normalizeFocus("  pricing "), "pricing");
});

test("config: missing ANTHROPIC_API_KEY is an honest SERVICE_UNAVAILABLE, thrown before fetch", async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    let fetchCalled = false;
    await assert.rejects(
      summarizeUrl({
        url: "https://example.com/article",
        fetchPage: async () => { fetchCalled = true; return HTML_PAGE; },
        createClient: fakeClient(VALID_OUTPUT),
      }),
      (e) => e instanceof AuditError && e.code === "SERVICE_UNAVAILABLE"
    );
    assert.equal(fetchCalled, false);
  } finally {
    process.env.ANTHROPIC_API_KEY = key;
  }
});

test("request builder: truncates nothing itself and injects markdown verbatim", () => {
  const req = buildSummarizeRequest("some markdown", null);
  assert.ok(req.messages[0].content.includes("some markdown"));
  assert.equal(buildSystemPrompt(null), buildSystemPrompt(undefined));
  assert.notEqual(buildSystemPrompt("x"), buildSystemPrompt(null));
});

test("tool schema: required fields match the documented output", () => {
  assert.deepEqual(Object.keys(SUMMARIZE_TOOL.input_schema.properties).sort(),
    ["entities", "key_facts", "summary", "title", "word_count"]);
});
