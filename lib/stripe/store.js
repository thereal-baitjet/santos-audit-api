// Durable store for the Stripe human-report path. Postgres when DATABASE_URL is
// set (production), in-memory fallback for local dev/tests. Mirrors the
// least-privilege connection pattern used by lib/deep/store.js.
const hasDatabase = () => !!process.env.DATABASE_URL;

let pgPool = null;
async function pg() {
  if (!pgPool) {
    const { default: pkg } = await import("pg");
    pgPool = new pkg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

const mem = new Map(); // session_id -> row (fallback)

// Atomically record a session the first time only. Returns true if THIS call
// inserted it (i.e. first delivery of the webhook), false if it already existed
// (a replay) — this is the idempotency gate.
export async function claimSession({ sessionId, targetUrl, email }) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `INSERT INTO stripe_purchases (session_id, target_url, email)
       VALUES ($1, $2, $3) ON CONFLICT (session_id) DO NOTHING RETURNING session_id`,
      [sessionId, targetUrl, email]
    );
    return rows.length > 0;
  }
  if (mem.has(sessionId)) return false;
  mem.set(sessionId, { session_id: sessionId, target_url: targetUrl, email, status: "pending" });
  return true;
}

export async function completePurchase(sessionId, reportId, report) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(
      `UPDATE stripe_purchases SET status='completed', report_id=$2, report=$3, completed_at=now() WHERE session_id=$1`,
      [sessionId, reportId, report]
    );
    return;
  }
  const row = mem.get(sessionId);
  if (row) Object.assign(row, { status: "completed", report_id: reportId, report });
}

export async function failPurchase(sessionId, message) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(`UPDATE stripe_purchases SET status='failed', error_message=$2 WHERE session_id=$1`, [sessionId, message?.slice(0, 500) ?? null]);
    return;
  }
  const row = mem.get(sessionId);
  if (row) Object.assign(row, { status: "failed", error_message: message });
}

export async function getReportById(reportId) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT report_id, target_url, report, completed_at FROM stripe_purchases WHERE report_id=$1 AND expires_at > now()`,
      [reportId]
    );
    return rows[0] ?? null;
  }
  for (const row of mem.values()) {
    if (row.report_id === reportId) return { report_id: reportId, target_url: row.target_url, report: row.report, completed_at: row.completed_at };
  }
  return null;
}
