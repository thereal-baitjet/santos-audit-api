// robots.txt patcher: re-opens a site to AI crawlers without opening private
// paths. Parsing and matching follow RFC 9309 (Robots Exclusion Protocol):
//
// - A group is one or more consecutive `User-agent` lines followed by rules.
//   A `User-agent` line that follows a rule starts a new group.
// - A crawler obeys ONLY the groups naming its product token (merged if there
//   are several); it falls back to `User-agent: *` only when none name it.
//   This is why the patch must copy the wildcard group's private Disallows
//   into the new AI group: once GPTBot has its own group it stops reading `*`.
// - Among matching rules the longest pattern wins; on a tie Allow wins.
//   `*` matches any run of characters and a trailing `$` anchors the end.
// - Rules before the first `User-agent`, and unknown keys, are ignored.
//   `Sitemap` is global and never belongs to a group.
//
// The function returns the full patched file rather than an append-only block.
// Appending is unsafe: an existing `User-agent: GPTBot / Disallow: /` group
// would MERGE with the appended one, and `Disallow: /` vs `Allow: /` is a
// same-length tie whose outcome depends on the crawler. Instead the blocked
// bots' tokens are removed from their old groups (and groups left with no
// agents are dropped whole), then one clean group is appended.

/** @typedef {{ token: string, operator: string, purpose: "training" | "search" | "user" }} AiCrawler */

/** @type {readonly AiCrawler[]} */
export const AI_CRAWLERS = Object.freeze([
  { token: "GPTBot", operator: "OpenAI", purpose: "training" },
  { token: "OAI-SearchBot", operator: "OpenAI", purpose: "search" },
  { token: "ChatGPT-User", operator: "OpenAI", purpose: "user" },
  { token: "ClaudeBot", operator: "Anthropic", purpose: "training" },
  { token: "Claude-SearchBot", operator: "Anthropic", purpose: "search" },
  { token: "Claude-User", operator: "Anthropic", purpose: "user" },
  { token: "PerplexityBot", operator: "Perplexity", purpose: "search" },
  { token: "Perplexity-User", operator: "Perplexity", purpose: "user" },
  // Control tokens, not fetchers: they govern whether already-crawled
  // content may be used for AI features and model training.
  { token: "Applebot-Extended", operator: "Apple", purpose: "training" },
  { token: "Google-Extended", operator: "Google", purpose: "training" },
]);

/** Paths kept closed to AI crawlers even when the original file allowed them. */
export const DEFAULT_PROTECTED_PATHS = Object.freeze(["/admin/", "/account/", "/cart/", "/checkout/", "/login"]);

const ROOT_PATTERNS = new Set(["/", "/*", "*"]);

/**
 * @typedef {{ type: "allow" | "disallow", path: string }} Rule
 * @typedef {{ agents: { token: string, line: number }[], rules: Rule[], lines: number[] }} Group
 */

/**
 * Single pass, line-indexed so the patch can delete exact lines later.
 * @param {string} text
 * @returns {Group[]}
 */
export function parseRobots(text) {
  /** @type {Group[]} */
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  String(text ?? "").split(/\r?\n/).forEach((raw, index) => {
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(raw.replace(/#.*$/, "").trim());
    if (!match) return;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], lines: [] };
        groups.push(current);
      }
      // "GPTBot/1.1" → "gptbot": match on the product token only.
      current.agents.push({ token: value.split("/")[0].toLowerCase(), line: index });
      current.lines.push(index);
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (!current || key === "sitemap") return;
    if (key === "allow" || key === "disallow") current.rules.push({ type: key, path: value });
    current.lines.push(index); // crawl-delay etc. travel with their group
  });
  return groups;
}

/** Rules a crawler obeys: its own groups merged, else the wildcard groups. */
export function rulesFor(groups, token) {
  const lower = token.toLowerCase();
  const own = groups.filter((g) => g.agents.some((a) => a.token === lower));
  const chosen = own.length ? own : groups.filter((g) => g.agents.some((a) => a.token === "*"));
  return chosen.flatMap((g) => g.rules);
}

function patternToRegExp(pattern) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** RFC 9309 longest-match decision for one path. */
export function isAllowed(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue; // empty Disallow = allow everything; empty Allow = no-op
    if (!patternToRegExp(rule.path).test(path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.type === "allow")) {
      best = rule;
    }
  }
  return !best || best.type === "allow";
}

/**
 * AI crawlers whose access to the site root is currently denied.
 * @param {Group[] | string} robots  parsed groups, or raw robots.txt text
 * @param {{ includeTraining?: boolean }} [options]
 * @returns {AiCrawler[]}
 */
export function blockedAiCrawlers(robots, { includeTraining = true } = {}) {
  const groups = typeof robots === "string" ? parseRobots(robots) : robots;
  return AI_CRAWLERS
    .filter((bot) => includeTraining || bot.purpose !== "training")
    .filter((bot) => !isAllowed(rulesFor(groups, bot.token), "/"));
}

/**
 * @param {string} currentRobotsTxt
 * @param {{ includeTraining?: boolean, protectPaths?: string[] }} [options]
 *   includeTraining: also re-open training crawlers (GPTBot, ClaudeBot,
 *   Applebot-Extended, Google-Extended). Default true. Pass false to welcome
 *   answer engines while still keeping content out of model training.
 * @returns {string} the full patched robots.txt, or "" when no AI crawler is blocked
 */
export function generateRobotsTxtPatch(currentRobotsTxt, options = {}) {
  const { protectPaths = DEFAULT_PROTECTED_PATHS } = options;
  const groups = parseRobots(currentRobotsTxt);
  const blocked = blockedAiCrawlers(groups, options);
  if (!blocked.length) return "";

  const blockedTokens = new Set(blocked.map((bot) => bot.token.toLowerCase()));

  // Private paths to keep closed: every non-root Disallow in the wildcard
  // group (the owner's own statement of what is private) and in the blocked
  // bots' own groups, plus the caller's list. Taking the union can only make
  // the patch stricter, never leakier.
  const preserved = new Set();
  const wildcardRules = groups.filter((g) => g.agents.some((a) => a.token === "*")).flatMap((g) => g.rules);
  for (const rules of [wildcardRules, ...blocked.map((bot) => rulesFor(groups, bot.token))]) {
    for (const rule of rules) {
      if (rule.type === "disallow" && rule.path && !ROOT_PATTERNS.has(rule.path)) preserved.add(rule.path);
    }
  }
  for (const path of protectPaths) preserved.add(path);

  const dropLines = new Set();
  for (const group of groups) {
    const removed = group.agents.filter((a) => blockedTokens.has(a.token));
    if (!removed.length) continue;
    if (removed.length === group.agents.length) group.lines.forEach((line) => dropLines.add(line));
    else removed.forEach((a) => dropLines.add(a.line));
  }

  const kept = String(currentRobotsTxt ?? "")
    .split(/\r?\n/)
    .filter((_, index) => !dropLines.has(index))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  const block = [
    "# Santos Intelligence agent-access patch",
    "# AI answer engines and assistants may read public pages; private paths stay closed.",
    ...blocked.map((bot) => `User-agent: ${bot.token}`),
    "Allow: /",
    ...[...preserved].map((path) => `Disallow: ${path}`),
  ];

  return `${kept ? `${kept}\n\n` : ""}${block.join("\n")}\n`;
}
