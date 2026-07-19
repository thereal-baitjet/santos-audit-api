// Durable job store for the Deep Page Audit platform.
//
// Adapters:
//  - Postgres (DATABASE_URL set): durable, multi-instance safe. Job leasing
//    uses FOR UPDATE SKIP LOCKED so a job can never run in two workers, and
//    lease expiry (visibility timeout) reclaims jobs from crashed workers.
//  - Memory (no DATABASE_URL): per-process only — local dev and tests. The
//    control plane refuses to expose deep-audit routes in production on this
//    adapter (see DEEP_AUDIT_ENABLED handling in the routes).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MAX_ATTEMPTS = Number(process.env.WORKER_MAX_ATTEMPTS ?? 3);
const LEASE_SECONDS = Number(process.env.WORKER_JOB_TIMEOUT_SECONDS ?? 300);

export const hasDatabase = () => !!process.env.DATABASE_URL;

/* ------------------------------ Postgres ------------------------------ */

let pgPool = null;
let migrated = false;

async function pg() {
  if (!pgPool) {
    const { default: pkg } = await import("pg");
    pgPool = new pkg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      // Supabase requires TLS; local postgres usually doesn't have certs.
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  if (!migrated) {
    try {
      const sql = readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../db/migrations/001_deep_audit.sql"),
        "utf-8"
      );
      await pgPool.query(sql);
    } catch (e) {
      // Least-privilege roles can't CREATE in the schema; that's fine as long
      // as the tables were provisioned externally (Supabase migration).
      await pgPool.query("SELECT 1 FROM audit_jobs LIMIT 0"); // rethrows if tables truly missing
      console.log("deep-audit schema managed externally; skipping auto-migration:", e.message.slice(0, 80));
    }
    migrated = true;
  }
  return pgPool;
}

const rowToJob = (r) =>
  r && {
    id: r.id, status: r.status, stage: r.stage, progress: r.progress,
    request: r.request, request_hash: r.request_hash,
    payment_reference: r.payment_reference, attempts: r.attempts,
    error_code: r.error_code, error_message: r.error_message,
    created_at: r.created_at, started_at: r.started_at,
    completed_at: r.completed_at, expires_at: r.expires_at,
  };

const pgStore = {
  async createJob(job) {
    const db = await pg();
    await db.query(
      `INSERT INTO audit_jobs (id, request, request_hash, idempotency_key_hash, payment_reference, price_atomic, network)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [job.id, job.request, job.requestHash, job.idemHash ?? null, job.paymentReference ?? null, job.priceAtomic ?? null, job.network ?? null]
    );
    await this.appendEvent(job.id, "created", null, 0, "job accepted and queued");
    return this.getJob(job.id);
  },

  async findByIdempotency(idemHash) {
    const db = await pg();
    const { rows } = await db.query(`SELECT * FROM audit_jobs WHERE idempotency_key_hash = $1`, [idemHash]);
    return rowToJob(rows[0]);
  },

  async getJob(id) {
    const db = await pg();
    const { rows } = await db.query(`SELECT * FROM audit_jobs WHERE id = $1`, [id]);
    return rowToJob(rows[0]);
  },

  async listEvents(jobId, limit = 100) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT event_type, stage, progress, message, created_at FROM audit_job_events WHERE job_id = $1 ORDER BY id ASC LIMIT $2`,
      [jobId, limit]
    );
    return rows;
  },

  async appendEvent(jobId, eventType, stage, progress, message) {
    const db = await pg();
    await db.query(
      `INSERT INTO audit_job_events (job_id, event_type, stage, progress, message) VALUES ($1, $2, $3, $4, $5)`,
      [jobId, eventType, stage ?? null, progress ?? null, message ?? null]
    );
  },

  async cancelJob(id) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE audit_jobs SET status = 'cancelled', completed_at = now()
       WHERE id = $1 AND status IN ('queued') RETURNING *`,
      [id]
    );
    if (rows[0]) await this.appendEvent(id, "cancelled", null, null, "cancelled by caller before execution");
    return rowToJob(rows[0]); // null => not cancellable (already running/terminal)
  },

  // Worker: atomically claim the oldest runnable job. Reclaims expired leases.
  async leaseNextJob(workerId) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE audit_jobs SET
         status = 'running', worker_id = $1, attempts = attempts + 1,
         started_at = COALESCE(started_at, now()),
         lease_expires_at = now() + make_interval(secs => $2)
       WHERE id = (
         SELECT id FROM audit_jobs
         WHERE (status = 'queued' AND attempts < $3)
            OR (status = 'running' AND lease_expires_at < now() AND attempts < $3)
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
      [workerId, LEASE_SECONDS, MAX_ATTEMPTS]
    );
    return rowToJob(rows[0]);
  },

  async heartbeat(jobId, stage, progress) {
    const db = await pg();
    await db.query(
      `UPDATE audit_jobs SET stage = $2, progress = $3, lease_expires_at = now() + make_interval(secs => $4)
       WHERE id = $1 AND status = 'running'`,
      [jobId, stage, progress, LEASE_SECONDS]
    );
    await this.appendEvent(jobId, "stage", stage, progress, null);
  },

  async isCancelled(jobId) {
    const j = await this.getJob(jobId);
    return !j || j.status === "cancelled";
  },

  // Worker liveness: workers upsert their row every poll; job creation refuses
  // to settle a payment unless some worker has beaten within maxAgeSeconds.
  async workerHeartbeat(workerId) {
    const db = await pg();
    await db.query(
      `INSERT INTO worker_heartbeats (worker_id, beat_at) VALUES ($1, now())
       ON CONFLICT (worker_id) DO UPDATE SET beat_at = now()`,
      [workerId]
    );
  },

  async workerAlive(maxAgeSeconds = 120) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT 1 FROM worker_heartbeats WHERE beat_at > now() - make_interval(secs => $1) LIMIT 1`,
      [maxAgeSeconds]
    );
    return rows.length > 0;
  },

  async completeJob(jobId, reportId, report, artifacts) {
    const db = await pg();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO audit_reports (id, job_id, schema_version, report) VALUES ($1, $2, $3, $4)
         ON CONFLICT (job_id) DO NOTHING`,
        [reportId, jobId, report.schema_version, report]
      );
      for (const a of artifacts) {
        await client.query(
          `INSERT INTO audit_artifacts (id, job_id, type, device, content_type, size_bytes, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
          [a.id, jobId, a.type, a.device ?? null, a.content_type, a.data.length, a.data]
        );
      }
      await client.query(
        `UPDATE audit_jobs SET status = 'completed', stage = 'completed', progress = 100, completed_at = now() WHERE id = $1`,
        [jobId]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await this.appendEvent(jobId, "completed", "completed", 100, "report ready");
  },

  async failJob(jobId, code, message, retryable) {
    const db = await pg();
    const job = await this.getJob(jobId);
    const exhausted = !retryable || (job && job.attempts >= MAX_ATTEMPTS);
    if (exhausted) {
      await db.query(
        `UPDATE audit_jobs SET status = 'failed', error_code = $2, error_message = $3, completed_at = now() WHERE id = $1`,
        [jobId, code, message?.slice(0, 500) ?? null]
      );
      await this.appendEvent(jobId, "failed", null, null, `${code}: ${message ?? ""}`.slice(0, 500));
    } else {
      // Back to the queue; lease already expired-or-cleared, attempts already counted.
      await db.query(
        `UPDATE audit_jobs SET status = 'queued', worker_id = NULL, lease_expires_at = NULL WHERE id = $1`,
        [jobId]
      );
      await this.appendEvent(jobId, "retrying", null, null, `${code}: ${message ?? ""}`.slice(0, 500));
    }
  },

  async getReport(jobId) {
    const db = await pg();
    const { rows } = await db.query(`SELECT report FROM audit_reports WHERE job_id = $1`, [jobId]);
    return rows[0]?.report ?? null;
  },

  async listArtifacts(jobId) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT id, type, device, content_type, size_bytes, created_at, expires_at
       FROM audit_artifacts WHERE job_id = $1 AND expires_at > now()`,
      [jobId]
    );
    return rows;
  },

  async getArtifact(artifactId) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT id, job_id, type, content_type, data FROM audit_artifacts WHERE id = $1 AND expires_at > now()`,
      [artifactId]
    );
    return rows[0] ?? null;
  },

  // Retention: delete expired artifacts and expire stale queued jobs.
  async cleanup() {
    const db = await pg();
    await db.query(`DELETE FROM worker_heartbeats WHERE beat_at < now() - interval '7 days'`);
    await db.query(`DELETE FROM audit_artifacts WHERE expires_at < now()`);
    await db.query(`UPDATE audit_jobs SET status = 'expired' WHERE status = 'queued' AND expires_at < now()`);
    await db.query(
      `UPDATE audit_jobs SET status = 'failed', error_code = 'AUDIT_FAILED', error_message = 'retries exhausted'
       WHERE status IN ('queued','running') AND attempts >= $1 AND (lease_expires_at IS NULL OR lease_expires_at < now())`,
      [MAX_ATTEMPTS]
    );
  },
};

/* ------------------------------- Memory ------------------------------- */

const mem = { jobs: new Map(), events: new Map(), reports: new Map(), artifacts: new Map(), byIdem: new Map(), heartbeats: new Map() };

const memStore = {
  async createJob(job) {
    const row = {
      id: job.id, status: "queued", stage: null, progress: 0,
      request: job.request, request_hash: job.requestHash,
      payment_reference: job.paymentReference ?? null, attempts: 0,
      error_code: null, error_message: null,
      created_at: new Date(), started_at: null, completed_at: null,
      expires_at: new Date(Date.now() + 30 * 864e5),
    };
    mem.jobs.set(job.id, row);
    mem.events.set(job.id, [{ event_type: "created", stage: null, progress: 0, message: "job accepted and queued", created_at: new Date() }]);
    if (job.idemHash) mem.byIdem.set(job.idemHash, job.id);
    return { ...row };
  },
  async findByIdempotency(h) { const id = mem.byIdem.get(h); return id ? { ...mem.jobs.get(id) } : null; },
  async getJob(id) { const j = mem.jobs.get(id); return j ? { ...j } : null; },
  async listEvents(id) { return mem.events.get(id) ?? []; },
  async appendEvent(id, event_type, stage, progress, message) {
    (mem.events.get(id) ?? mem.events.set(id, []).get(id)).push({ event_type, stage, progress, message, created_at: new Date() });
  },
  async cancelJob(id) {
    const j = mem.jobs.get(id);
    if (!j || j.status !== "queued") return null;
    j.status = "cancelled"; j.completed_at = new Date();
    await this.appendEvent(id, "cancelled", null, null, "cancelled by caller before execution");
    return { ...j };
  },
  async leaseNextJob(workerId) {
    for (const j of mem.jobs.values()) {
      if (j.status === "queued" && j.attempts < MAX_ATTEMPTS) {
        j.status = "running"; j.worker_id = workerId; j.attempts++; j.started_at ??= new Date();
        return { ...j };
      }
    }
    return null;
  },
  async heartbeat(id, stage, progress) {
    const j = mem.jobs.get(id);
    if (j?.status === "running") { j.stage = stage; j.progress = progress; }
    await this.appendEvent(id, "stage", stage, progress, null);
  },
  async isCancelled(id) { const j = mem.jobs.get(id); return !j || j.status === "cancelled"; },
  async workerHeartbeat(workerId) { mem.heartbeats.set(workerId, Date.now()); },
  async workerAlive(maxAgeSeconds = 120) {
    return [...mem.heartbeats.values()].some((t) => t > Date.now() - maxAgeSeconds * 1000);
  },
  async completeJob(id, reportId, report, artifacts) {
    mem.reports.set(id, report);
    for (const a of artifacts) mem.artifacts.set(a.id, { ...a, job_id: id, size_bytes: a.data.length, created_at: new Date(), expires_at: new Date(Date.now() + 72 * 36e5) });
    const j = mem.jobs.get(id);
    if (j) { j.status = "completed"; j.stage = "completed"; j.progress = 100; j.completed_at = new Date(); }
    await this.appendEvent(id, "completed", "completed", 100, "report ready");
  },
  async failJob(id, code, message, retryable) {
    const j = mem.jobs.get(id);
    if (!j) return;
    if (!retryable || j.attempts >= MAX_ATTEMPTS) {
      j.status = "failed"; j.error_code = code; j.error_message = message; j.completed_at = new Date();
    } else {
      j.status = "queued"; j.worker_id = null;
    }
  },
  async getReport(id) { return mem.reports.get(id) ?? null; },
  async listArtifacts(id) {
    return [...mem.artifacts.values()].filter((a) => a.job_id === id)
      .map(({ data, ...meta }) => meta);
  },
  async getArtifact(artId) { return mem.artifacts.get(artId) ?? null; },
  async cleanup() {},
};

export function getStore() {
  return hasDatabase() ? pgStore : memStore;
}
