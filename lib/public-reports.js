// Store for opt-in public report listings (public_reports table, migration
// 009). One row per domain — the latest report wins. Postgres when
// DATABASE_URL is set (production), in-memory fallback for local dev/tests.
// Same connection and fallback pattern as lib/leads/store.js.
//
// Privacy: only the report JSON the caller passes in is stored — never the
// payer identity, email, or IP of whoever triggered the audit.
const hasDatabase = () => !!process.env.DATABASE_URL;

let pgPool = null;
async function pg() {
  if (!pgPool) {
    const { default: pkg } = await import("pg");
    pgPool = new pkg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

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
  const n = Math.max(1, Math.min(Number(limit) || 50, 200));
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
