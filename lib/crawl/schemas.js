// Shared contracts for site crawl + bulk page processing (POST /v1/crawl).
// Used by the control plane, the worker, and tests — one source of truth for
// limits, pricing, and URL filtering so the route and worker can't drift.
import { validateTarget, AuditError } from "../safe-fetch.js";

export const JOB_STATES = ["queued", "running", "completed", "failed", "expired", "cancelled"];
export const TERMINAL_STATES = ["completed", "failed", "expired", "cancelled"];
export const MODES = ["crawl", "bulk"];

const num = (name, fallback) => Number(process.env[name] ?? fallback);

export const LIMITS = {
  maxPages: num("CRAWL_MAX_PAGES", 500),
  maxDepth: num("CRAWL_MAX_DEPTH", 5),
  maxBulkUrls: num("CRAWL_MAX_BULK_URLS", 1000),
  maxBudgetUsdc: process.env.CRAWL_MAX_BUDGET_USDC ?? "25",
  maxPatterns: 20,
  maxPatternLength: 200,
  maxWildcardsPerPattern: 8,
  maxOpenJobsPerPayer: num("CRAWL_MAX_OPEN_JOBS_PER_PAYER", 2),
};

export const PRICES = {
  pageUsdc: process.env.CRAWL_PAGE_PRICE_USDC ?? "0.005",
  renderedPageUsdc: process.env.CRAWL_RENDER_PAGE_PRICE_USDC ?? "0.02",
};

// Quoted verbatim in docs and discovery metadata — keep this the single copy.
export const PAYMENT_CONTRACT =
  "Payment is an x402 'upto' authorization for at most budget_usdc. Nothing is charged when the job is created. After the job finishes, you are charged once for the pages actually processed (per-page price, higher for rendered pages), never more than budget_usdc. A job that processes no pages is not charged. The crawl stops when the next page would exceed the budget.";

/* ------------------------------ money ------------------------------ */

const USDC_DECIMALS = 6;

/** Exact decimal USDC string/number -> atomic BigInt. Rejects >6 decimals, negatives, junk. */
export function usdcToAtomic(value) {
  const s = typeof value === "number" ? value.toString() : String(value ?? "").trim();
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) throw new RangeError(`not a USDC amount with at most ${USDC_DECIMALS} decimals: ${s}`);
  return BigInt(m[1]) * 10n ** 6n + BigInt((m[2] ?? "").padEnd(USDC_DECIMALS, "0"));
}

export function atomicToUsdc(atomic) {
  const a = BigInt(atomic);
  const whole = a / 1_000_000n;
  const frac = (a % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export const pagePriceAtomic = (rendered) => usdcToAtomic(rendered ? PRICES.renderedPageUsdc : PRICES.pageUsdc);

/** How many pages the budget can pay for, capped by max_pages. */
export function pageCapFor(budgetAtomic, render, maxPages) {
  const affordable = BigInt(budgetAtomic) / pagePriceAtomic(render);
  return Number(affordable < BigInt(maxPages) ? affordable : BigInt(maxPages));
}

/* --------------------------- URL filtering --------------------------- */

// Glob over pathname+search: `**` matches anything, `*` anything except "/",
// `?` one character. Everything else is literal. Wildcards are capped so a
// hostile pattern can't make matching blow up on long URLs.
export function compileGlob(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") { re += ".*"; i++; }
    else if (c === "*") re += "[^/]*";
    else if (c === "?") re += ".";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** include: at least one must match (when any are given). exclude: none may match. */
export function matchesFilters(url, include, exclude) {
  const u = new URL(url);
  const target = u.pathname + u.search;
  const test = (globs) => globs.some((g) => compileGlob(g).test(target));
  if (include.length && !test(include)) return false;
  return !test(exclude);
}

function patternErrors(name, value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > LIMITS.maxPatterns || !value.every((p) => typeof p === "string" && p.length > 0)) {
    return [`${name} must be an array of up to ${LIMITS.maxPatterns} non-empty strings`];
  }
  const bad = value.find((p) => p.length > LIMITS.maxPatternLength || (p.match(/[*?]/g) ?? []).length > LIMITS.maxWildcardsPerPattern || !p.startsWith("/"));
  return bad === undefined ? [] : [`${name} pattern "${bad.slice(0, 40)}" must start with "/", be <= ${LIMITS.maxPatternLength} chars, and use <= ${LIMITS.maxWildcardsPerPattern} wildcards`];
}

/* ---------------------------- bulk inputs ---------------------------- */

/** "https://x.com/p/{n}" with {from, to, step} -> explicit URL list. */
export function expandTemplate(template, range) {
  const step = range.step ?? 1;
  const out = [];
  for (let n = range.from; n <= range.to; n += step) out.push(template.replaceAll("{n}", String(n)));
  return out;
}

function templateErrors(body) {
  const { template, range } = body;
  if (typeof template !== "string" || !template.includes("{n}")) return ["template must be a string containing {n}"];
  if (!range || typeof range !== "object") return ["range {from, to, step?} is required with template"];
  const ints = [range.from, range.to, range.step ?? 1];
  if (!ints.every(Number.isSafeInteger) || range.from < 0 || range.to < range.from || (range.step ?? 1) < 1) {
    return ["range needs integers with 0 <= from <= to and step >= 1"];
  }
  const count = Math.floor((range.to - range.from) / (range.step ?? 1)) + 1;
  if (count > LIMITS.maxBulkUrls) return [`template range expands to ${count} URLs; the limit is ${LIMITS.maxBulkUrls}`];
  return [];
}

/* ---------------------------- validation ---------------------------- */

/**
 * Validate a create request. Returns { errors } or { errors: [], normalized }.
 * Runs SSRF shape checks on every target and enforces one origin per job.
 */
export function parseCreateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { errors: ["body must be a JSON object"] };
  const errors = [];

  const inputs = ["url", "urls", "template"].filter((k) => body[k] !== undefined);
  if (inputs.length !== 1) {
    return { errors: ["provide exactly one of: url (crawl a site), urls (bulk list), template + range (bulk {n} range)"] };
  }
  const mode = inputs[0] === "url" ? "crawl" : "bulk";

  if (body.respect_robots === false) errors.push("robots.txt cannot be disabled");
  if (body.callback_url !== undefined && body.callback_url !== null) errors.push("callback_url is not supported yet — poll status_url");

  let budgetAtomic = null;
  try {
    budgetAtomic = usdcToAtomic(body.budget_usdc);
    if (budgetAtomic > usdcToAtomic(LIMITS.maxBudgetUsdc)) errors.push(`budget_usdc may be at most ${LIMITS.maxBudgetUsdc}`);
  } catch {
    errors.push("budget_usdc (decimal USDC amount, e.g. \"1.50\") is required");
  }

  if (body.render !== undefined && typeof body.render !== "boolean") errors.push("render must be a boolean");
  const render = body.render === true;

  const pagesLimit = mode === "bulk" ? LIMITS.maxBulkUrls : LIMITS.maxPages;
  const maxPages = body.max_pages ?? (mode === "crawl" ? 100 : pagesLimit);
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > pagesLimit) {
    errors.push(`max_pages must be an integer from 1 to ${pagesLimit}`);
  }

  let maxDepth = 0;
  if (mode === "crawl") {
    maxDepth = body.max_depth ?? 2;
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > LIMITS.maxDepth) {
      errors.push(`max_depth must be an integer from 0 to ${LIMITS.maxDepth}`);
    }
  } else if (body.max_depth !== undefined) {
    errors.push("max_depth applies only to crawl mode (url); bulk mode fetches exactly the listed URLs");
  }

  errors.push(...patternErrors("include", body.include), ...patternErrors("exclude", body.exclude));

  let urls = [];
  if (mode === "crawl") {
    if (typeof body.url !== "string" || !body.url.trim()) errors.push("url (string) is required");
    else urls = [body.url.trim()];
  } else if (body.urls !== undefined) {
    if (!Array.isArray(body.urls) || body.urls.length === 0 || body.urls.length > LIMITS.maxBulkUrls || !body.urls.every((u) => typeof u === "string")) {
      errors.push(`urls must be a non-empty array of up to ${LIMITS.maxBulkUrls} strings`);
    } else urls = body.urls.map((u) => u.trim());
  } else {
    const tErrors = templateErrors(body);
    errors.push(...tErrors);
    if (!tErrors.length) urls = expandTemplate(body.template.trim(), body.range);
  }

  // Same SSRF/shape checks safe-fetch applies to every fetch, plus one origin per job.
  let origin = null;
  const targets = [];
  for (const u of urls) {
    let parsed;
    try {
      parsed = validateTarget(u);
    } catch (e) {
      errors.push(`${u.slice(0, 100)}: ${e instanceof AuditError ? e.message : "not a valid URL"}`);
      if (errors.length > 20) break;
      continue;
    }
    if (origin === null) origin = parsed.origin;
    else if (parsed.origin !== origin) { errors.push(`all URLs must share one origin (${origin}); got ${parsed.origin}`); break; }
    targets.push(parsed.href);
  }

  if (errors.length) return { errors };

  const unique = [...new Set(targets)];
  const pageCap = pageCapFor(budgetAtomic, render, mode === "bulk" ? Math.min(maxPages, unique.length) : maxPages);
  if (pageCap < 1) {
    return { errors: [`budget_usdc must cover at least one page (${render ? PRICES.renderedPageUsdc : PRICES.pageUsdc} USDC${render ? " rendered" : ""})`] };
  }

  return {
    errors: [],
    normalized: {
      mode,
      origin,
      ...(mode === "crawl" ? { url: unique[0], max_depth: maxDepth } : { urls: unique }),
      max_pages: maxPages,
      render,
      include: body.include ?? [],
      exclude: body.exclude ?? [],
      respect_robots: true,
      budget_atomic: budgetAtomic.toString(),
      page_cap: pageCap,
      prices: { page_usdc: PRICES.pageUsdc, rendered_page_usdc: PRICES.renderedPageUsdc },
    },
  };
}
