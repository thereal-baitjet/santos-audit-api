// Durable job store for site crawl + bulk page processing.
//
// Adapters mirror lib/deep/store.js:
//  - Postgres (DATABASE_URL set): durable, multi-instance safe.
//  - Memory (no DATABASE_URL): per-process only — local dev and tests. The
//    route refuses to run in production on this adapter (see lib/crawl/gate.js).
//
// Payment invariants enforced here, not just in the route:
//  - (payer, payment_nonce) is unique: one signed authorization funds one job.
//  - settlement_status moves authorized -> settling -> settled|voided|failed
//    via conditional updates, so a job is charged at most once.|voided|failed via conditional updates, so a job is charged at most once.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import { pgPool as sharedPool, hasDatabase } from "../pg.js";

export { hasDatabase };

export const urlHash = (url) => createHash("sha256").update(url).digest("hex").slice(0, 32);

export class DuplicateAuthorizationError extends Error {
  constructor() {
    super("This payment authorization has already funded a crawl job.");
    this.code = "PAYMENT_ALREADY_USED";
  }
}

/* ------------------------------ Postgres ------------------------------ */

let migrated = false;

async function pg() {
  const pool = await sharedPool();
  if (!migrated) {
    try {
      const sql = readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../db/migrations/011_crawl_jobs.sql"),
        "utf-8"
      );
      await pool.query(sql);
    } catch (e) {
      await pool.query("SELECT 1 FROM crawl_jobs LIMIT 0"); // rethrows if tables truly missing
      console.log("crawl schema managed externally; skipping auto-migration:", e.message.slice(0, 80));
    }
    migrated = true;
  }
  return pool;
}

// Public view of a job row. payment_payload / payment_requirements are never
// included — only claimSettlement() hands them out, to the settlement path.
const rowToJob = (r) =>
  r && {
    id: r.id, mode: r.mode, status: r.status, stage: r.stage, progress: r.progress,
    request: r.request, request_hash: r.request_hash, origin: r.origin, page_cap: r.page_cap,
    network: r.network, payer: r.payer,
    budget_atomic: String(r.budget_atomic), cost_atomic: String(r.cost_atomic),
    authorization_expires_at: r.authorization_expires_at,
    settlement_status: r.settlement_status,
    settled_atomic: r.settled_atomic == null ? null : String(r.settled_atomic),
    settlement_tx: r.settlement_tx, settlement_error: r.settlement_error, settled_at: r.settled_at,
    pages_fetched: r.pages_fetched, pages_rendered: r.pages_rendered,
    pages_failed: r.pages_failed, pages_skipped: r.pages_skipped,
    bytes_stored: String(r.bytes_stored), manifest_storage_key: r.manifest_storage_key,
    attempts: r.attempts, error_code: r.error_code, error_message: r.error_message,
    created_at: r.created_at, started_at: r.started_at,
    completed_at: r.completed_at, expires_at: r.expires_at,
  };

const isUniqueViolation = (e, constraintHint) => e?.code === "23505" && (!constraintHint || String(e.constraint ?? "").includes(constraintHint));

const pgStore = {
  async createJob(job) {
    const db = await pg();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO crawl_jobs (id, mode, request, request_hash, idempotency_key_hash, origin, page_cap,
           network, payer, payment_nonce, budget_atomic, payment_payload, payment_requirements, authorization_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [job.id, job.request.mode, job.request, job.requestHash, job.idemHash ?? null, job.request.origin, job.request.page_cap,
          job.network, job.payer, job.paymentNonce, job.request.budget_atomic, job.paymentPayload, job.paymentRequirements,
          job.authorizationExpiresAt]
      );
      const seeds = job.request.mode === "crawl" ? [job.request.url] : job.request.urls;
      await client.query(
        `INSERT INTO crawl_pages (job_id, url, url_hash, depth)
         SELECT $1, u, h, 0 FROM unnest($2::text[], $3::text[]) AS t(u, h)
         ON CONFLICT (job_id, url_hash) DO NOTHING`,
        [job.id, seeds, seeds.map(urlHash)]
      );
      await client.query(
        `INSERT INTO crawl_job_events (job_id, event_type, progress, message) VALUES ($1, 'created', 0, $2)`,
        [job.id, `job accepted and queued; ${seeds.length} seed URL(s); payment authorized, not charged`]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      if (isUniqueViolation(e, "payment_nonce")) throw new DuplicateAuthorizationError();
      throw e;
    } finally {
      client.release();
    }
    return this.getJob(job.id);
  },

  async findByIdempotency(idemHash) {
    const db = await pg();
    const { rows } = await db.query(`SELECT * FROM crawl_jobs WHERE idempotency_key_hash = $1`, [idemHash]);
    return rowToJob(rows[0]);
  },

  async getJob(id) {
    const db = await pg();
    const { rows } = await db.query(`SELECT * FROM crawl_jobs WHERE id = $1`, [id]);
    return rowToJob(rows[0]);
  },

  async countOpenJobsForPayer(payer) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM crawl_jobs WHERE payer = $1 AND settlement_status IN ('authorized', 'settling')`,
      [payer]
    );
    return rows[0].n;
  },

  async listEvents(jobId, limit = 100) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT event_type, stage, progress, message, created_at FROM crawl_job_events WHERE job_id = $1 ORDER BY id ASC LIMIT $2`,
      [jobId, limit]
    );
    return rows;
  },

  async appendEvent(jobId, eventType, stage, progress, message) {
    const db = await pg();
    await db.query(
      `INSERT INTO crawl_job_events (job_id, event_type, stage, progress, message) VALUES ($1, $2, $3, $4, $5)`,
      [jobId, eventType, stage ?? null, progress ?? null, message ?? null]
    );
  },

  // Settlement: atomically move authorized -> settling and hand back the stored
  // authorization. Returns null when another caller already claimed it.
  async claimSettlement(id) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE crawl_jobs SET settlement_status = 'settling'
       WHERE id = $1 AND settlement_status = 'authorized' RETURNING *`,
      [id]
    );
    const r = rows[0];
    return r ? { job: rowToJob(r), paymentPayload: r.payment_payload, paymentRequirements: r.payment_requirements } : null;
  },

  async finishSettlement(id, { status, settledAtomic = null, tx = null, error = null }) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE crawl_jobs SET settlement_status = $2, settled_atomic = $3, settlement_tx = $4,
         settlement_error = $5, settled_at = CASE WHEN $2 = 'settled' THEN now() ELSE settled_at END
       WHERE id = $1 AND settlement_status = 'settling' RETURNING *`,
      [id, status, settledAtomic, tx, error]
    );
    if (rows[0]) await this.appendEvent(id, `settlement_${status}`, null, null, error ?? (tx ? `tx ${tx}` : null));
    return rowToJob(rows[0]);
  },
};

/* ------------------------------- Memory ------------------------------- */

const mem = { jobs: new Map(), secrets: new Map(), events: new Map(), pages: new Map(), byIdem: new Map(), nonces: new Set() };

const memStore = {
  async createJob(job) {
    const nonceKey = `${job.payer}:${job.paymentNonce}`;
    if (mem.nonces.has(nonceKey)) throw new DuplicateAuthorizationError();
    mem.nonces.add(nonceKey);
    const row = rowToJob({
      id: job.id, mode: job.request.mode, status: "queued", stage: null, progress: 0,
      request: job.request, request_hash: job.requestHash, origin: job.request.origin, page_cap: job.request.page_cap,
      network: job.network, payer: job.payer, budget_atomic: job.request.budget_atomic, cost_atomic: 0,
      authorization_expires_at: job.authorizationExpiresAt, settlement_status: "authorized", settled_atomic: null,
      settlement_tx: null, settlement_error: null, settled_at: null,
      pages_fetched: 0, pages_rendered: 0, pages_failed: 0, pages_skipped: 0, bytes_stored: 0, manifest_storage_key: null,
      attempts: 0, error_code: null, error_message: null,
      created_at: new Date(), started_at: null, completed_at: null, expires_at: new Date(Date.now() + 7 * 864e5),
    });
    mem.jobs.set(job.id, row);
    mem.secrets.set(job.id, { paymentPayload: job.paymentPayload, paymentRequirements: job.paymentRequirements });
    const seeds = job.request.mode === "crawl" ? [job.request.url] : job.request.urls;
    mem.pages.set(job.id, seeds.map((url) => ({ url, url_hash: urlHash(url), depth: 0, status: "queued" })));
    mem.events.set(job.id, [{ event_type: "created", stage: null, progress: 0, message: `job accepted and queued; ${seeds.length} seed URL(s); payment authorized, not charged`, created_at: new Date() }]);
    if (job.idemHash) mem.byIdem.set(job.idemHash, job.id);
    return { ...row };
  },
  async findByIdempotency(h) { const id = mem.byIdem.get(h); return id ? { ...mem.jobs.get(id) } : null; },
  async getJob(id) { const j = mem.jobs.get(id); return j ? { ...j } : null; },
  async countOpenJobsForPayer(payer) {
    return [...mem.jobs.values()].filter((j) => j.payer === payer && ["authorized", "settling"].includes(j.settlement_status)).length;
  },
  async listEvents(id) { return mem.events.get(id) ?? []; },
  async appendEvent(id, event_type, stage, progress, message) {
    (mem.events.get(id) ?? mem.events.set(id, []).get(id)).push({ event_type, stage, progress, message, created_at: new Date() });
  },
  async claimSettlement(id) {
    const j = mem.jobs.get(id);
    if (!j || j.settlement_status !== "authorized") return null;
    j.settlement_status = "settling";
    return { job: { ...j }, ...mem.secrets.get(id) };
  },
  async finishSettlement(id, { status, settledAtomic = null, tx = null, error = null }) {
    const j = mem.jobs.get(id);
    if (!j || j.settlement_status !== "settling") return null;
    Object.assign(j, {
      settlement_status: status, settled_atomic: settledAtomic == null ? null : String(settledAtomic),
      settlement_tx: tx, settlement_error: error, settled_at: status === "settled" ? new Date() : j.settled_at,
    });
    await this.appendEvent(id, `settlement_${status}`, null, null, error ?? (tx ? `tx ${tx}` : null));
    return { ...j };
  },
  // Test seams: the worker will own usage updates; tests need to fake them.
  _setUsage(id, patch) { Object.assign(mem.jobs.get(id), patch); },
  _pages(id) { return mem.pages.get(id) ?? []; },
  _reset() { for (const m of Object.values(mem)) m.clear(); },
};

export function getStore() {
  return hasDatabase() ? pgStore : memStore;
}
