// Optional "ai-summary" module: Claude writes a prioritized remediation
// narrative grounded EXCLUSIVELY in the deterministic findings passed to it.
// It never generates or modifies scores, metrics, or pass/fail states, and
// the report labels this section as model-generated narrative.
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are the report-writing module of an automated website audit platform.
You receive deterministic audit findings as JSON. Write a remediation summary for the site owner.

Rules:
- Every statement must be grounded in a provided finding; cite finding ids like (a11y.color-contrast).
- Never invent findings, numbers, scores, or severities not present in the input.
- Prioritize by user impact: critical/serious first, quick wins flagged.
- Plain English, direct, no fluff. No preamble.`;

export async function generateSummary(findings, scores) {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "not_available", reason: "ANTHROPIC_API_KEY not configured" };

  const client = new Anthropic();
  const failing = findings.filter((f) => f.status === "fail" || f.status === "warning").slice(0, 60)
    .map(({ id, category, severity, title, recommendation }) => ({ id, category, severity, title, recommendation }));

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Category scores (deterministic, do not alter): ${JSON.stringify(scores)}\n\nFindings:\n${JSON.stringify(failing)}\n\nWrite: (1) a 3-sentence executive summary, (2) a prioritized remediation list (top 10 max, each citing finding ids).`,
      }],
    });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return {
      status: "completed",
      engine: "claude-opus-4-8",
      disclaimer: "Model-generated narrative grounded in the deterministic findings above; scores and findings themselves are not model-generated.",
      summary: text,
    };
  } catch (e) {
    return { status: "failed", reason: String(e.message ?? e).slice(0, 200) };
  }
}
