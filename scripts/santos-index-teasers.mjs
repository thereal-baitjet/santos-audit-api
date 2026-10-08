// Draft Santos Index teardown posts (LinkedIn / X) for leaderboard domains.
//
//   node scripts/santos-index-teasers.mjs                     # from scripts/seed-results.jsonl
//   node scripts/santos-index-teasers.mjs --db                # from public_reports (needs DATABASE_URL)
//   node scripts/santos-index-teasers.mjs --platform x --limit 10 --max-score 59
//   node scripts/santos-index-teasers.mjs --format jsonl > teasers.jsonl
//
// Worst scores first by default (--sort desc for best-first). Output is a
// set of DRAFTS for a human to post. Every post uses the domain's stored
// audit, and each draft carries its audit date; drafts older than
// --max-age-days (default 30) are flagged STALE, and audits that hit a
// bot wall or error page are skipped entirely. Re-run the audit before
// posting a stale one: a public claim about a brand must match its current site.
import { readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { generateViralTeaser } from "../lib/growth/viral-teaser.js";
import { headlineScore, isReliableAudit, normalizeAuditPayload } from "../lib/growth/payload.js";

const { values: args } = parseArgs({
  options: {
    db: { type: "boolean", default: false },
    limit: { type: "string", default: "20" },
    "max-score": { type: "string" },
    "max-age-days": { type: "string", default: "30" },
    platform: { type: "string", default: "linkedin" },
    sort: { type: "string", default: "asc" },
    format: { type: "string", default: "md" },
  },
});

const SEED = new URL("./seed-results.jsonl", import.meta.url).pathname;
const DAY_MS = 86_400_000;

/** @returns {Promise<{ domain: string, report: any, auditedAt: string | null }[]>} */
async function loadRows() {
  if (args.db) {
    const { topPublicReports, getPublicReport } = await import("../lib/public-reports.js");
    const listed = await topPublicReports(1000);
    const rows = [];
    for (const { domain } of listed) {
      const row = await getPublicReport(domain);
      if (row) rows.push({ domain: row.domain, report: row.report, auditedAt: row.created_at ? new Date(row.created_at).toISOString() : null });
    }
    return rows;
  }
  if (!existsSync(SEED)) throw new Error(`${SEED} not found. Run "node scripts/seed-public-reports.mjs audit" first, or pass --db.`);
  return readFileSync(SEED, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((row) => ({ domain: row.domain, report: row.report, auditedAt: row.report?.fetched_at ?? null }));
}

const loaded = await loadRows();
// Audits that hit a bot wall / rate limit / error page say nothing true about
// the brand; never draft a public post from them.
const unreliable = loaded.filter((row) => !isReliableAudit(row.report));
const rows = loaded
  .filter((row) => isReliableAudit(row.report))
  .map((row) => ({ ...row, payload: normalizeAuditPayload(row.report) }))
  .filter((row) => row.payload)
  .map((row) => ({ ...row, score: headlineScore(row.payload) }))
  .filter((row) => Number.isFinite(row.score))
  .filter((row) => args["max-score"] == null || row.score <= Number(args["max-score"]))
  .sort((a, b) => (args.sort === "desc" ? b.score - a.score : a.score - b.score) || a.domain.localeCompare(b.domain))
  .slice(0, Number(args.limit));

const maxAgeMs = Number(args["max-age-days"]) * DAY_MS;
const drafts = rows.map((row) => {
  const ageMs = row.auditedAt ? Date.now() - Date.parse(row.auditedAt) : Infinity;
  return {
    domain: row.domain,
    score: row.score,
    audited_at: row.auditedAt,
    stale: !(ageMs <= maxAgeMs),
    post: generateViralTeaser(row.domain, row.payload, { platform: args.platform }),
  };
});

if (args.format === "jsonl") {
  for (const draft of drafts) console.log(JSON.stringify(draft));
} else {
  console.log(`# Santos Index teaser drafts (${args.platform}, ${drafts.length} posts)\n`);
  for (const draft of drafts) {
    const date = draft.audited_at?.slice(0, 10) ?? "unknown date";
    console.log(`## ${draft.domain} · ${draft.score}/100 · audited ${date}${draft.stale ? " · STALE: re-audit before posting" : ""}\n`);
    console.log("```text\n" + draft.post + "\n```\n");
  }
}

if (unreliable.length) console.error(`Skipped ${unreliable.length} domains whose audit hit a non-2xx page (bot wall, rate limit, or error); re-audit them to include.`);
const stale = drafts.filter((draft) => draft.stale).length;
if (stale) console.error(`${stale}/${drafts.length} drafts are older than ${args["max-age-days"]} days; re-audit before posting them.`);
