// Durable store for the Stripe human-report path. Postgres when DATABASE_URL is
// set (production), in-memory fallback for local dev/tests. Mirrors the
// least-privilege connection pattern used by lib/deep/store.js.
import { pgPool as pg, hasDatabase } from "../pg.js";

const mem = new Map(); // session_id -> row (fallback)

// Atomically record a session the first time only. Returns true if THIS call
// inserted it (i.e. first delivery of the webhook), false if it already existed
// (a replay) — this is the idempotency gate. `tier` (quick|deep) comes from the
// Checkout Session metadata and drives fulfilment.
export async function claimSession({ sessionId, targetUrl, email, tier = "quick" }) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `INSERT INTO stripe_purchases (session_id, target_url, email, tier)
       VALUES ($1, $2, $3, $4) ON CONFLICT (session_id) DO NOTHING RETURNING session_id`,
      [sessionId, targetUrl, email, tier]
    );
    return rows.length > 0;
  }
  if (mem.has(sessionId)) return false;
  mem.set(sessionId, { session_id: sessionId, target_url: targetUrl, email, tier, status: "pending" });
  return true;
}

// Deep tier only: the fulfilment is asynchronous (a worker queue job), so the
// purchase moves to "processing" with its audit job id until the cron deep-tier
// sweep completes it and emails the buyer.
export async function markProcessing(sessionId, jobId) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(`UPDATE stripe_purchases SET status='processing', job_id=$2 WHERE session_id=$1`, [sessionId, jobId]);
    return;
  }
  const row = mem.get(sessionId);
  if (row) Object.assign(row, { status: "processing", job_id: jobId });
}

export async function completePurchase(sessionId, reportId, report, jobId = null) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(
      `UPDATE stripe_purchases SET status='completed', report_id=$2, report=$3, job_id=COALESCE($4, job_id), completed_at=now() WHERE session_id=$1`,
      [sessionId, reportId, report, jobId]
    );
    return;
  }
  const row = mem.get(sessionId);
  if (row) Object.assign(row, { status: "completed", report_id: reportId, report, ...(jobId ? { job_id: jobId } : {}) });
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

// Cron deep-tier sweep (app/api/cron/daily): deep purchases still waiting on
// their audit job, oldest first, bounded so one cron tick stays small.
export async function listProcessingDeepPurchases(limit = 25) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT session_id, target_url, email, job_id FROM stripe_purchases
       WHERE tier = 'deep' AND status = 'processing'
       ORDER BY created_at ASC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  return [...mem.values()]
    .filter((row) => row.tier === "deep" && row.status === "processing")
    .slice(0, limit)
    .map((row) => ({ session_id: row.session_id, target_url: row.target_url, email: row.email, job_id: row.job_id }));
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
