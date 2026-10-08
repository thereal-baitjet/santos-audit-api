// Santos Index teaser: a four-line public teardown post for LinkedIn / X,
// generated from a REAL audit result. Every number and claim comes from the
// payload; the hook adjective is chosen by score band, never by brand, so the
// post can't overstate a failure the audit didn't find.
//
//   1. hook      "<domain> scores <n>/100 for AI Agent Readiness."
//   2. pillars   🟢 90+  🟡 60–89  🔴 <60  ⚪ not applicable
//   3. why       the single most severe failed check, in business terms
//   4. CTA       check your own domain
import { PILLARS, bareDomain, failedFindings, headlineScore, pillarView, scoreEmoji } from "./payload.js";
import { copyFor } from "./impact-copy.js";
import { SITE_URL } from "../marketing-content.js";

/** @typedef {import("./payload.js").AuditPayload} AuditPayload */

const X_LIMIT = 280;

function hook(domain, score) {
  if (score == null) return `${domain} can't even be scored for AI Agent Readiness: AI agents couldn't get far enough to test it.`;
  if (score < 60) return `${domain} scores a shocking ${score}/100 for AI Agent Readiness.`;
  if (score < 90) return `${domain} scores just ${score}/100 for AI Agent Readiness.`;
  return `${domain} scores ${score}/100 for AI Agent Readiness, and here's what they got right.`;
}

function pillarLine(dimensions) {
  return PILLARS.map(({ id, name }) => {
    const value = dimensions[id];
    return `${scoreEmoji(value)} ${name} ${value == null ? "n/a" : value}`;
  }).join(" · ");
}

function whyLine(payload, score) {
  const worst = failedFindings(payload)[0];
  if (worst) return copyFor(worst).why;
  if (score != null && score >= 90) return "llms.txt, structured identity, and machine interfaces all check out, so AI agents can find, read, and act on the site.";
  return "Most checks couldn't run, which usually means AI agents are being turned away before they reach the content.";
}

/**
 * X counts every code point above U+FFFF (emoji) as two characters and URLs as
 * 23. That's close enough to the real weighted-length algorithm to keep
 * generated posts under the limit without pulling in twitter-text.
 */
export function xLength(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "x".repeat(23));
  let length = 0;
  for (const char of withoutUrls) length += char.codePointAt(0) > 0xffff ? 2 : 1;
  return length;
}

/**
 * @param {string} domain
 * @param {AuditPayload} scores
 * @param {{ platform?: "linkedin" | "x", ctaUrl?: string }} [options]
 * @returns {string}
 */
export function generateViralTeaser(domain, scores, options = {}) {
  const { platform = "linkedin", ctaUrl = SITE_URL } = options;
  const name = bareDomain(domain);
  const score = headlineScore(scores);
  const lines = [
    hook(name, score),
    pillarLine(pillarView(scores).dimensions),
    whyLine(scores, score),
    `Is your site invisible to AI agents too? Check your domain at ${ctaUrl}`,
  ];
  let post = lines.join("\n\n");

  // On X, shorten the CTA first; the evidence (line 3) is what makes it shareable.
  if (platform === "x" && xLength(post) > X_LIMIT) {
    lines[3] = `Check yours: ${ctaUrl}`;
    post = lines.join("\n\n");
  }
  if (platform === "x" && xLength(post) > X_LIMIT) {
    post = lines.join("\n");
  }
  return post;
}
