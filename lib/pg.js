// One Postgres pool for the whole process.
//
// Every store used to open its own pool — eight of them, max 2-3 connections
// each — so a single serverless instance could hold ~20 connections. That is
// more than the entire budget: DATABASE_URL points at Supabase's SESSION-mode
// pooler, where each client connection pins a dedicated Postgres backend for
// its whole life and the ceiling is pool_size 15. A few warm instances were
// enough to exhaust it, at which point every store failed at once with
// EMAXCONNSESSION and the free-tier limiter reported itself degraded.
// Sharing one pool makes an instance's footprint `max`, not `max × stores`.
//
// idleTimeoutMillis is deliberately short. Vercel FREEZES an idle instance
// rather than terminating it, so an idle socket goes on holding a pooler slot
// long after the request that opened it finished — we measured connections
// idle for ten minutes against a default eviction timer of ten seconds.
// Releasing eagerly is what hands the slot back.
//
// connectionTimeoutMillis means a saturated pooler fails fast and visibly
// instead of hanging until the function hits its maxDuration.
//
// The real fix for session-mode exhaustion is the TRANSACTION-mode pooler
// (port 6543), which multiplexes and does not pin a backend per client. This
// module is safe either way: node-postgres sends unnamed queries, which
// transaction mode supports.

export const hasDatabase = () => !!process.env.DATABASE_URL;

let pool = null;

/** The shared pool. Lazily created so paths that never touch the DB pay nothing. */
export async function pgPool() {
  if (!pool) {
    const { default: pkg } = await import("pg");
    pool = new pkg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX ?? 3),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 5000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5000),
      allowExitOnIdle: true,
      // Supabase requires TLS; local postgres usually doesn't have certs.
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
    // A pool that emits 'error' with no listener takes the process down. An
    // idle backend dropped by the pooler is routine here, not fatal: the pool
    // discards the client and the next query opens a fresh one.
    pool.on("error", (e) => console.error("pg pool idle client error:", e.message));
  }
  return pool;
}

/** Test seam: drop the shared pool so a suite can start from a clean slate. */
export async function resetPgPool() {
  const existing = pool;
  pool = null;
  if (existing) await existing.end().catch(() => {});
}
