// "Fix-it-for-me" kit: one audit, three deliverables.
//
//   1. executive summary (Markdown + structured)
//   2. publish-ready llms.txt built from the live homepage + discovered interfaces
//   3. patched robots.txt when AI crawlers are blocked
//
// Network cost is the audit's own bounded budget plus exactly two fetches we
// make directly: the homepage (reused by the audit via existingPage, so it is
// not fetched twice) and /robots.txt (the audit only reports blocked paths,
// not the file body we need to patch). assembleFixKit() is pure so the whole
// output can be tested without the network.
import * as cheerio from "cheerio";
import { safeFetch } from "../safe-fetch.js";
import { auditAgentReadiness } from "../agent-readiness/analyze.js";
import { websiteIntelligenceSummary } from "../website-intelligence.js";
import { extractInternalLinks } from "../llms-txt.js";
import { buildExecutiveSummary, generateExecutiveSummary } from "./executive-summary.js";
import { generateOptimizedLLMsTxt } from "./llms-txt-generator.js";
import { blockedAiCrawlers, generateRobotsTxtPatch } from "./robots-patch.js";
import { isLlmsTxtMissing, statusOf } from "./payload.js";

export const FIX_KIT_SCHEMA_VERSION = "1.0.0";

const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
// Audit evidence redacts query strings to "?…"; such URLs aren't publishable.
const publishable = (url) => (typeof url === "string" && !url.includes("…") ? url : undefined);

/**
 * SiteInfo for generateOptimizedLLMsTxt from the homepage plus the machine
 * interfaces the audit discovered. Only facts observed on the site are used:
 * a missing description leaves the summary empty rather than inventing one.
 * @returns {import("./llms-txt-generator.js").SiteInfo}
 */
export function siteInfoFromPage({ html, url, interfaces = {} }) {
  const base = new URL(url);
  const $ = cheerio.load(html ?? "");
  const title = clean($("title").first().text());
  const doc = interfaces.documentation?.find((item) => item.readable);
  return {
    name: clean($('meta[property="og:site_name"]').attr("content")) || title.split(/\s[|–—-]\s/)[0] || base.hostname,
    url: base.origin,
    summary: clean($('meta[name="description"]').attr("content")) || clean($('meta[property="og:description"]').attr("content")),
    interfaces: {
      openapi: publishable(interfaces.openapi?.find((item) => item.valid)?.url),
      mcp: publishable(interfaces.mcp?.[0]?.url),
      capabilities: publishable(interfaces.capability_manifests?.[0]?.url),
      docs: publishable(doc?.url),
    },
    sections: [{ title: "Pages", links: extractInternalLinks($, base).map((link) => ({ title: link.text, url: link.url })) }],
  };
}

/**
 * Pure assembly from an audit report and the two fetched bodies.
 * @param {{ report: import("./payload.js").AuditPayload, html: string, robotsTxt: string | null }} input
 */
export function assembleFixKit({ report, html, robotsTxt }) {
  const origin = report.target.canonical_origin;
  const llmsMissing = isLlmsTxtMissing(report);
  const llmsNeeded = llmsMissing || statusOf(report, "agent.llms_txt.format") === "fail";
  const blocked = robotsTxt == null ? [] : blockedAiCrawlers(robotsTxt);
  const patched = robotsTxt == null ? "" : generateRobotsTxtPatch(robotsTxt);

  const notes = ["Generated drafts: review before publishing."];
  if (robotsTxt == null) notes.push("robots.txt could not be fetched, so no robots patch was generated.");

  return {
    schema_version: FIX_KIT_SCHEMA_VERSION,
    target: report.target,
    website_intelligence_score: report.website_intelligence?.score ?? null,
    score: report.score,
    grade: report.grade,
    readiness_level: report.readiness_level,
    executive_summary: {
      markdown: generateExecutiveSummary(report),
      data: buildExecutiveSummary(report),
    },
    fixes: {
      llms_txt: {
        needed: llmsNeeded,
        reason: llmsMissing ? "No /llms.txt was found." : llmsNeeded ? "The existing /llms.txt does not follow the llmstxt.org structure." : "An llms.txt already exists; this is an optional upgrade.",
        publish_at: new URL("/llms.txt", origin).href,
        content: generateOptimizedLLMsTxt(siteInfoFromPage({ html, url: report.target.final_url, interfaces: report.interfaces })),
      },
      robots_txt: {
        needed: Boolean(patched),
        blocked_ai_crawlers: blocked.map((bot) => bot.token),
        publish_at: new URL("/robots.txt", origin).href,
        content: patched || null,
      },
    },
    notes,
  };
}

async function fetchRobots(origin, fetcher) {
  try {
    const res = await fetcher(new URL("/robots.txt", origin).href, {}, { allowedContentTypes: /^text\/plain\b/i, maxResponseBytes: 128_000 });
    if (res.response.status === 200) return res.body;
    // 4xx = no robots file = everything allowed (RFC 9309 §2.3.1.3).
    return res.response.status >= 400 && res.response.status < 500 ? "" : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} url  public target URL (already validated by the caller)
 * @param {{ fetcher?: typeof safeFetch, audit?: typeof auditAgentReadiness }} [deps]
 */
export async function buildFixKit(url, { fetcher = safeFetch, audit = auditAgentReadiness } = {}) {
  const page = await fetcher(url);
  const result = await audit(url, {
    mode: "quick",
    fetcher,
    existingPage: {
      body: page.body,
      finalUrl: page.finalUrl,
      status: page.response.status,
      headers: Object.fromEntries(page.response.headers ?? []),
    },
  });
  const report = { ...result, website_intelligence: websiteIntelligenceSummary({ agentReadiness: result }) };
  const robotsTxt = await fetchRobots(report.target.canonical_origin, fetcher);
  return assembleFixKit({ report, html: page.body, robotsTxt });
}
