// Shared free-tier limiter: 1 audit per IP per day, across the demo route and
// the MCP preview tool.
//
// Storage adapters:
//  - Upstash Redis (RATE_LIMIT_STORE_URL + RATE_LIMIT_STORE_TOKEN): durable
//    across cold starts and instances. Claims use atomic SET NX EX, so
//    concurrent requests cannot double-spend the daily allowance.
//  - In-memory Map (fallback): per-instance only; fine for local dev/tests.
//
// On storage outage the limiter FAILS OPEN (the free tier keeps working and
// may occasionally over-grant) — availability of the funnel beats strictness.
//
// Privacy: IPs are HMAC-hashed with RATE_LIMIT_HASH_SECRET before being used
// as storage keys, so raw addresses never persist.
import { createHmac } from "node:crypto";

const STORE_URL = process.env.RATE_LIMIT_STORE_URL?.replace(/\/+$/, "");
const STORE_TOKEN = process.env.RATE_LIMIT_STORE_TOKEN;
const HASH_SECRET = process.env.RATE_LIMIT_HASH_SECRET ?? "santos-demo-limit";

const memoryLog = new Map(); // key -> "1" (fallback adapter)

// HMAC-hash a raw identity (IP, email, …) so it can be used as a storage key
// without persisting the raw value.
export function hashIdentity(value) {
  return createHmac("sha256", HASH_SECRET).update(value).digest("hex").slice(0, 32);
}

function dayKey(ip) {
  return `demo:${new Date().toISOString().slice(0, 10)}:${hashIdentity(ip)}`;
}

export function secondsUntilUtcMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((midnight - now) / 1000));
}

async function redis(command) {
  const res = await fetch(STORE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${STORE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`rate-limit store HTTP ${res.status}`);
  return (await res.json()).result;
}

// Postgres adapter (demo_claims table, migration 004): used when Upstash is
// not configured but DATABASE_URL is — the common case on this deployment.
// Same semantics: atomic single claim per key, durable across cold starts.
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

const usePg = () => !STORE_URL && !!process.env.DATABASE_URL;

// Generic peek: is this key still unclaimed? Returns true when free, false
// when an unexpired claim exists. Fails open (true) on storage outage.
export async function peekKey(key) {
  if (STORE_URL && STORE_TOKEN) {
    try {
      return (await redis(["EXISTS", key])) === 0;
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  if (usePg()) {
    try {
      const db = await pg();
      const { rows } = await db.query(
        "SELECT 1 FROM demo_claims WHERE key = $1 AND expires_at > now()", [key]
      );
      return rows.length === 0;
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  return memoryLog.get(key) === undefined;
}

// Generic atomic claim with a caller-chosen TTL. Returns false if already
// claimed — including by a concurrent request that won the race.
// Call AFTER the guarded work succeeds so failures don't burn credit.
export async function claimKey(key, ttlSecs) {
  if (STORE_URL && STORE_TOKEN) {
    try {
      // SET key 1 NX EX <ttl>: only one caller per key gets "OK".
      return (await redis(["SET", key, "1", "NX", "EX", String(ttlSecs)])) === "OK";
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  if (usePg()) {
    try {
      const db = await pg();
      // Opportunistic tidy-up: keys are short-lived, so this stays tiny.
      await db.query("DELETE FROM demo_claims WHERE expires_at < now()").catch(() => {});
      // INSERT … ON CONFLICT DO NOTHING: only one caller per key gets a row back.
      const { rows } = await db.query(
        `INSERT INTO demo_claims (key, expires_at)
         VALUES ($1, now() + make_interval(secs => $2))
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [key, ttlSecs]
      );
      return rows.length > 0;
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  if (memoryLog.get(key) !== undefined) return false;
  memoryLog.set(key, "1");
  return true;
}

// Peek: has this IP already used today's free audit?
export async function hasFreeAudit(ip) {
  return peekKey(dayKey(ip));
}

// Atomically claim today's free audit. Returns false if already claimed —
// including by a concurrent request that won the race.
// Call AFTER a successful audit so failures don't burn the day's credit.
export async function markFreeAudit(ip) {
  return claimKey(dayKey(ip), secondsUntilUtcMidnight());
}

export function ipFromRequest(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
