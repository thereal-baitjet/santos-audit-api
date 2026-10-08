// "Fix-it-for-me" llms.txt generator from structured site metadata.
//
// lib/llms-txt.js drafts an llms.txt by scraping ONE page; this builds a
// publish-ready one from metadata the owner (or a crawl) already has. Output
// follows the llmstxt.org convention, in the order parsers expect:
//
//   # <name>                         required, the only mandatory element
//   > <one-line summary>             optional blockquote
//   <free-form detail paragraphs>    optional, no headings
//   ## <Section>                     H2 file lists
//   - [title](url): description
//   ## Optional                      always last; agents may skip it under a tight context budget
//
// Normalisation choices:
// - URLs resolve against site.url, so relative paths are fine; only http(s)
//   survive, and each URL appears once (first occurrence wins). Duplicate
//   links waste the reader's context window.
// - "Machine interfaces" is emitted first because it is what an agent most
//   needs (OpenAPI, MCP, capability manifest); empty sections are dropped.
// - "[", "]" in link text and newlines anywhere are escaped/collapsed so a
//   title can never break the Markdown link grammar.

/**
 * @typedef {object} SiteLink
 * @property {string} title
 * @property {string} url             absolute, or relative to SiteInfo.url
 * @property {string} [description]
 *
 * @typedef {object} SiteInfo
 * @property {string} name
 * @property {string} url             canonical origin, e.g. "https://example.com"
 * @property {string} [summary]       one sentence: what it is and who it's for
 * @property {string[]} [details]     short paragraphs: key facts, selection guidance, limits
 * @property {{ openapi?: string, mcp?: string, capabilities?: string, llmsFull?: string, docs?: string, pricing?: string, status?: string }} [interfaces]
 * @property {{ title: string, links: SiteLink[] }[]} [sections]
 * @property {SiteLink[]} [optional]  secondary links, emitted under "## Optional"
 * @property {{ email?: string, url?: string }} [contact]
 */

const oneLine = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const linkText = (text) => oneLine(text).replace(/([[\]])/g, "\\$1");

const INTERFACE_LABELS = [
  ["openapi", "OpenAPI specification", "Typed contract for every API operation"],
  ["mcp", "MCP server", "Model Context Protocol endpoint for AI assistants"],
  ["capabilities", "Capability manifest", "Inputs, outputs, pricing, and limits per capability"],
  ["docs", "Documentation", "Human and agent-readable usage guide"],
  ["pricing", "Pricing", "Plans, units, and payment methods"],
  ["status", "Status", "Uptime and incident history"],
  ["llmsFull", "llms-full.txt", "Complete documentation in one Markdown file"],
];

/**
 * @param {SiteInfo} siteMetadata
 * @returns {string}
 */
export function generateOptimizedLLMsTxt(siteMetadata) {
  const site = siteMetadata;
  const base = new URL(site.url);
  const seen = new Set();

  /** Resolve, filter to http(s), and dedupe; returns null to drop the link. */
  const resolve = (raw) => {
    let url;
    try {
      url = new URL(raw, base);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    if (seen.has(url.href)) return null;
    seen.add(url.href);
    return url.href;
  };

  const renderLinks = (links) =>
    links.flatMap((link) => {
      const url = resolve(link.url);
      if (!url || !oneLine(link.title)) return [];
      const note = oneLine(link.description);
      return [`- [${linkText(link.title)}](${url})${note ? `: ${note}` : ""}`];
    });

  const lines = [`# ${oneLine(site.name) || base.hostname}`, ""];
  if (oneLine(site.summary)) lines.push(`> ${oneLine(site.summary)}`, "");
  for (const paragraph of site.details ?? []) {
    if (oneLine(paragraph)) lines.push(oneLine(paragraph), "");
  }

  const section = (title, links) => {
    const rendered = renderLinks(links);
    if (rendered.length) lines.push(`## ${oneLine(title)}`, "", ...rendered, "");
  };

  const interfaceLinks = INTERFACE_LABELS
    .filter(([key]) => site.interfaces?.[key])
    .map(([key, title, description]) => ({ title, url: site.interfaces[key], description }));
  section("Machine interfaces", interfaceLinks);

  for (const s of site.sections ?? []) {
    if (oneLine(s.title).toLowerCase() === "optional") continue; // reserved, rendered last
    section(s.title, s.links ?? []);
  }

  // Email is plain text, not a link: resolve() only admits http(s).
  const contact = renderLinks(site.contact?.url ? [{ title: "Contact", url: site.contact.url, description: "Support and sales" }] : []);
  if (oneLine(site.contact?.email)) contact.push(`- Email: ${oneLine(site.contact.email)}`);
  if (contact.length) lines.push("## Contact", "", ...contact, "");

  section("Optional", site.optional ?? []);

  return lines.join("\n").trimEnd() + "\n";
}
