// Store for opt-in public report listings (public_reports table, migration
// 009). One row per domain — the latest report wins. Postgres when
// DATABASE_URL is set (production), in-memory fallback for local dev/tests.
// Same connection and fallback pattern as lib/leads/store.js.
//
// Privacy: only the report JSON the caller passes in is stored — never the
// payer identity, email, or IP of whoever triggered the audit.
import { pgPool as pg, hasDatabase } from "./pg.js";
import { claimKey, peekKey } from "./demo-limit.js";

const mem = new Map(); // fallback rows: domain -> row

// Normalize a URL or bare domain to its listing key: hostname of the FINAL
// url (post-redirect), lowercased, leading "www." stripped. Accepts full
// URLs and bare hostnames alike; returns null when unparseable.
export function domainFromUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let host;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

// Latest-wins upsert keyed on the domain of the final url. Returns the
// stored row, or null when the url has no usable hostname (callers treat
// public listing as best-effort and never fail the audit over it).
export async function upsertPublicReport({ url, score, report, source }) {
  const domain = domainFromUrl(url);
  if (!domain || !report || typeof report !== "object") return null;
  const safeScore = Number.isFinite(score) ? Math.round(score) : null;
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `INSERT INTO public_reports (domain, url, score, report, source)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (domain) DO UPDATE
       SET url = EXCLUDED.url, score = EXCLUDED.score, report = EXCLUDED.report,
           source = EXCLUDED.source, created_at = now()
       RETURNING domain, url, score, source, created_at`,
      [domain, url, safeScore, JSON.stringify(report), source]
    );
    return rows[0];
  }
  const row = { domain, url, score: safeScore, report, source, created_at: new Date().toISOString() };
  mem.set(domain, row);
  return row;
}

// The current public report for a domain (same normalization as the
// upsert), or null.
export async function getPublicReport(domain) {
  const key = domainFromUrl(domain);
  if (!key) return null;
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      "SELECT domain, url, score, report, source, created_at FROM public_reports WHERE domain = $1",
      [key]
    );
    return rows[0] ?? null;
  }
  return mem.get(key) ?? null;
}

// Leaderboard rows: highest score first (unscored last), ties broken by
// most recent audit.
export async function topPublicReports(limit = 50) {
  const n = Math.max(1, Math.min(Number(limit) || 50, 1000));
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT domain, url, score, source, created_at FROM public_reports
       ORDER BY score DESC NULLS LAST, created_at DESC
       LIMIT $1`,
      [n]
    );
    return rows;
  }
  return [...mem.values()]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, n)
    .map(({ report, ...row }) => row);
}

// Integer average of all listed scores (unscored rows skipped), or null when
// there are no scored public reports yet.
export async function averagePublicScore() {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query("SELECT AVG(score)::int AS avg FROM public_reports WHERE score IS NOT NULL");
    return rows[0]?.avg ?? null;
  }
  const scores = [...mem.values()].map((row) => row.score).filter((score) => Number.isFinite(score));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

// ── Published-report marks ──────────────────────────────────────────────────
// A published report is readable by anyone, so it must not unlock paid-for
// extras (free remediation) for whoever downloads it. public_reports keeps
// one row per domain, so a replaced report vanishes from it while copies
// remain in the wild; the mark records every signature ever published.
const PUBLISHED_MARK_TTL_SECS = 10 * 365 * 24 * 60 * 60;
const publishedKey = (signature) => `published-report:${signature}`;

// Call BEFORE upsertPublicReport, so a failure between the two never leaves
// a report public but unmarked.
export async function markReportPublished(report) {
  if (typeof report?.signature !== "string") return false;
  return claimKey(publishedKey(report.signature), PUBLISHED_MARK_TTL_SECS);
}

// True when this exact report (by signature) was ever published: marked at
// publish time, or still the current listing (covers reports published
// before marks existed). Throws if the listing cannot be read, so callers
// can fail closed.
export async function wasReportPublished(report) {
  const signature = report?.signature;
  if (typeof signature !== "string") return false;
  if (!(await peekKey(publishedKey(signature)))) return true;
  const domains = new Set(
    [report.target?.final_url, report.target?.canonical_origin, report.url].map(domainFromUrl).filter(Boolean)
  );
  for (const domain of domains) {
    if ((await getPublicReport(domain))?.report?.signature === signature) return true;
  }
  return false;
}
