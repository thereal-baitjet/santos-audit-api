// Shared durable sink for first-party analytics events (table analytics_events,
// migration 008). Used by the /api/analytics beacon route and by server-side
// emitters (e.g. the Stripe webhook's payment_completed) so both share one
// insert path. FAILS OPEN like lib/demo-limit.js: analytics must never break
// the request it rides on.
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

// Insert one event. Returns true when persisted; false (and logs) when there
// is no database configured or the insert failed — callers can fall back to a
// console trail but should never fail their own response on this.
export async function recordEvent({ event, props = {}, clientTs = null, ipHash = null, userAgent = null }) {
  if (!hasDatabase()) return false;
  try {
    const db = await pg();
    await db.query(
      `INSERT INTO analytics_events (event, props, client_ts, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [event, props, clientTs, ipHash, userAgent?.slice(0, 300) ?? null]
    );
    return true;
  } catch (e) {
    console.error("analytics store unavailable (failing open):", e.message);
    return false;
  }
}
