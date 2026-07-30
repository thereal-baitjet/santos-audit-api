// Free-tier limiter: 1 call per IP per day.
//
// The free tier used to span six HTTP /demo endpoints, a verified-email token
// quota, and three inline MCP tools. All of that is retired — the paid x402
// routes are the product. What remains is a single shop window: the MCP
// audit_website_preview tool, so an agent that discovers this server can see
// one real result before being asked to pay. Everything else answers 402.
//
// Because there is exactly one free surface and no token identity, the quota
// is a binary claim on `demo:<date>:<hash(ip)>` — there is no N/day counter.
//
// Storage adapters:
//  - Upstash Redis (RATE_LIMIT_STORE_URL + RATE_LIMIT_STORE_TOKEN): claims use
//    atomic SET NX EX, so concurrent requests cannot double-spend the day.
//  - Postgres (demo_claims, migration 004): the production path here.
//  - In-memory Map: per-instance only; local dev and tests.
//
// On storage outage the limiter enters DEGRADED mode: a small in-process
// emergency allowance per key, one ops alert, and denial past the cap — it
// does not fail open. It now also RECOVERS on its own; see below.
//
// Privacy: IPs are HMAC-hashed with RATE_LIMIT_HASH_SECRET before being used
// as storage keys, so raw addresses never persist.
import { createHmac } from "node:crypto";
import { requireSecret } from "./required-env.js";
import { pgPool, hasDatabase } from "./pg.js";

const STORE_URL = process.env.RATE_LIMIT_STORE_URL?.replace(/\/+$/, "");
const STORE_TOKEN = process.env.RATE_LIMIT_STORE_TOKEN;
const HASH_SECRET = requireSecret("RATE_LIMIT_HASH_SECRET", "santos-demo-limit");

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

const usePg = () => !STORE_URL && hasDatabase();

// ---------------------------------------------------------------------------
// Degraded mode.
//
// The limiter used to fail fully open: a storage outage meant unlimited free
// calls, which on a public browser-capable service is an invitation to abuse
// at exactly the moment we cannot measure it. It falls back to a small
// in-process allowance instead, alerts once, and denies past the cap.
//
// Honest limitation: this counter is per serverless instance, so the effective
// ceiling during an outage is EMERGENCY_MAX × live instances, not a global
// number. That is bounded and alertable, which unlimited was not — it is a
// blast-radius reduction, not a precise quota.
//
// Degradation is also SELF-HEALING. It previously latched forever: nothing
// outside the test seam ever cleared degradedSince, so one transient blip left
// an instance reporting degraded for its entire life. A real incident on
// 2026-07-30 (Supabase session-pooler exhaustion, EMAXCONNSESSION) recovered in
// seconds while the free LLM path stayed refused until the instances recycled.
// Any successful store operation now clears the flag and closes the incident.
// ---------------------------------------------------------------------------

const EMERGENCY_MAX = Math.max(0, Number(process.env.FREE_TIER_EMERGENCY_MAX ?? 2));
// How long one outage is treated as a single incident for alerting purposes.
const DEGRADED_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

const emergencyGrants = new Map(); // key -> grants made on this instance
let degradedSince = null;
let degradedReason = null;
let lastAlertAt = 0;

/** Current limiter health, for callers that gate expensive work on it. */
export function limiterStatus() {
  return {
    degraded: degradedSince !== null,
    since: degradedSince,
    reason: degradedReason,
    emergencyMax: EMERGENCY_MAX,
    grantsOnThisInstance: [...emergencyGrants.values()].reduce((a, b) => a + b, 0),
  };
}

/** Test seam: forget that an outage happened. */
export function resetLimiterStatus() {
  emergencyGrants.clear();
  degradedSince = null;
  degradedReason = null;
  lastAlertAt = 0;
}

// Called after every successful store operation. Recovery is the common case
// after a pooler blip, so it must not need a deploy or an instance recycle.
function markHealthy() {
  if (degradedSince === null) return;
  const since = degradedSince;
  degradedSince = null;
  degradedReason = null;
  emergencyGrants.clear();
  console.log(`rate-limit store recovered (degraded since ${since})`);
  // Fire-and-forget: an ops channel that only ever sees the alarm and never
  // the all-clear trains you to ignore it.
  import("../notify.js")
    .then(({ notifyOpsAlert }) =>
      notifyOpsAlert({
        title: "Free-tier limiter RECOVERED — quota enforced again",
        detail: `The rate-limit store is reachable again. Durable quota enforcement resumed. Degraded since ${since}.`,
      })
    )
    .catch(() => {});
}

// Awaited by callers, deliberately. A floating promise here would be killed
// when a serverless instance freezes after the response, so the incident alert
// would silently never arrive — the failure mode that looks exactly like "no
// incident". The webhook has a 4s timeout so awaiting it cannot stall a request.
async function enterDegraded(error) {
  const first = degradedSince === null;
  if (first) {
    degradedSince = new Date().toISOString();
    degradedReason = error?.message ?? String(error);
  }
  console.error(`rate-limit store unavailable (degraded, max ${EMERGENCY_MAX}/key/instance):`, degradedReason);

  // Alert on entry and at most once per cooldown, so a sustained outage does
  // not become an alert storm that gets muted — the point is remediation speed,
  // and a muted channel is slower than no channel.
  const now = Date.now();
  if (now - lastAlertAt <= DEGRADED_ALERT_COOLDOWN_MS) return;
  lastAlertAt = now;

  try {
    const { notifyOpsAlert } = await import("../notify.js");
    const result = await notifyOpsAlert({
      urgent: true,
      title: "Free-tier limiter DEGRADED — quota not enforced",
      detail:
        "The rate-limit store is unreachable, so the free MCP preview quota cannot be enforced durably. " +
        "Serving continues on a bounded emergency allowance. Paid routes are unaffected.",
      fields: [
        { name: "Cause", value: degradedReason ?? "unknown" },
        { name: "Emergency allowance", value: `${EMERGENCY_MAX} per key per instance, then denied`, inline: true },
        { name: "Degraded since", value: degradedSince ?? "just now", inline: true },
        {
          name: "Check first",
          value:
            "1. Postgres connection count — EMAXCONNSESSION means the Supabase\n" +
            "   SESSION-mode pooler is full (pool_size 15), not that the DB is down.\n" +
            "   Confirm with: select count(*) from pg_stat_activity where usename='santos_worker';\n" +
            "2. Upstash, if RATE_LIMIT_STORE_URL is configured\n" +
            "3. Supabase project health",
        },
        { name: "Exposure while degraded", value: "Free MCP preview only. Paid x402 routes never depend on this limiter." },
        { name: "Self-healing", value: "Clears automatically on the next successful store call; an all-clear follows." },
      ],
    });
    if (!result?.delivered) {
      console.error(`limiter degradation alert NOT delivered (${result?.reason}) — remediation will be slower`);
    }
  } catch (e) {
    console.error("limiter degradation alert threw:", e.message);
  }
}

/** Non-mutating check: is there any emergency allowance left for this key? */
function emergencyHasRoom(key) {
  return (emergencyGrants.get(key) ?? 0) < EMERGENCY_MAX;
}

/** Consume one unit of emergency allowance. False once the cap is reached. */
function emergencyGrant(key) {
  const used = emergencyGrants.get(key) ?? 0;
  if (used >= EMERGENCY_MAX) return false;
  emergencyGrants.set(key, used + 1);
  return true;
}

// Generic peek: is this key still unclaimed? Returns true when free, false
// when an unexpired claim exists. On storage outage, true only while this
// key still has emergency allowance left.
export async function peekKey(key) {
  if (STORE_URL && STORE_TOKEN) {
    try {
      const free = (await redis(["EXISTS", key])) === 0;
      markHealthy();
      return free;
    } catch (e) {
      await enterDegraded(e);
      return emergencyHasRoom(key);
    }
  }
  if (usePg()) {
    try {
      const db = await pgPool();
      const { rows } = await db.query(
        "SELECT 1 FROM demo_claims WHERE key = $1 AND expires_at > now()", [key]
      );
      markHealthy();
      return rows.length === 0;
    } catch (e) {
      await enterDegraded(e);
      return emergencyHasRoom(key);
    }
  }
  markHealthy();
  return memoryLog.get(key) === undefined;
}

// Day keys are never reused (a fresh `demo:<date>:<iphash>` per IP per day),
// so expired rows would accumulate forever without a sweep. The old code swept
// the whole table on EVERY claim, which is exactly the kind of per-request
// extra statement that exhausted the connection pooler. Sweeping ~1% of the
// time keeps the table bounded at a fraction of the cost, and it is
// fire-and-forget: a failed tidy-up must never fail a claim.
const SWEEP_PROBABILITY = Number(process.env.DEMO_CLAIMS_SWEEP_PROBABILITY ?? 0.01);
function sweepOccasionally(db) {
  if (Math.random() >= SWEEP_PROBABILITY) return;
  db.query("DELETE FROM demo_claims WHERE expires_at < now()").catch(() => {});
}

// Generic atomic claim with a caller-chosen TTL. Returns false if already
// claimed — including by a concurrent request that won the race.
// Call AFTER the guarded work succeeds so failures don't burn credit.
export async function claimKey(key, ttlSecs) {
  if (STORE_URL && STORE_TOKEN) {
    try {
      // SET key 1 NX EX <ttl>: only one caller per key gets "OK".
      const won = (await redis(["SET", key, "1", "NX", "EX", String(ttlSecs)])) === "OK";
      markHealthy();
      return won;
    } catch (e) {
      await enterDegraded(e);
      return emergencyGrant(key);
    }
  }
  if (usePg()) {
    try {
      const db = await pgPool();
      // ONE round trip, atomic, and expiry-aware.
      //
      // This used to be a table-wide `DELETE … WHERE expires_at < now()`
      // followed by an INSERT — two statements per claim, and the caller that
      // exhausted the pooler was issuing dozens of claims per request.
      //
      // A data-modifying CTE cannot replace the sweep: every sub-statement in
      // one statement sees the same snapshot, so the INSERT would still
      // conflict with the row the DELETE is removing and the key would be
      // unclaimable forever. DO UPDATE … WHERE expired is the correct form:
      //   no row        -> insert, RETURNING yields the key  -> claimed
      //   expired row   -> update fires, RETURNING yields it -> claimed
      //   live row      -> WHERE fails, RETURNING is empty   -> already taken
      const { rows } = await db.query(
        `INSERT INTO demo_claims (key, expires_at)
         VALUES ($1, now() + make_interval(secs => $2))
         ON CONFLICT (key) DO UPDATE
           SET expires_at = EXCLUDED.expires_at
           WHERE demo_claims.expires_at < now()
         RETURNING key`,
        [key, ttlSecs]
      );
      markHealthy();
      sweepOccasionally(db);
      return rows.length > 0;
    } catch (e) {
      await enterDegraded(e);
      return emergencyGrant(key);
    }
  }
  // The memory adapter is always reachable, so reaching it IS a healthy store.
  // Marking here too keeps recovery adapter-independent rather than a property
  // of whichever backend happened to answer.
  markHealthy();
  if (memoryLog.get(key) !== undefined) return false;
  memoryLog.set(key, "1");
  return true;
}

// How many times to re-pick a slot after losing a race for it.
const SLOT_CLAIM_ATTEMPTS = 3;

/**
 * Claim the lowest free slot of a fixed-window counter (N calls per window),
 * returning false when the window is full.
 *
 * The obvious form — try slot 1, then slot 2, then slot 3 — costs one query per
 * slot already taken, so a caller's Nth request in the window costs N queries
 * and a full 30-slot window costs 465 of them. That quadratic is what turned a
 * burst of /v1/verify traffic into connection-pooler exhaustion on 2026-07-30:
 * the endpoint that tripped the alert was also the one generating the load.
 *
 * On Postgres this is ONE round trip — enumerate candidate slots, skip the ones
 * holding a live claim, take the lowest survivor. Two concurrent callers can
 * still choose the same slot; the loser's ON CONFLICT yields no row, so we
 * re-pick a bounded number of times rather than falsely reporting a full
 * window. Other adapters keep the sequential form; they are dev/test paths.
 */
export async function claimSlot(prefix, slots, ttlSecs) {
  if (usePg()) {
    for (let attempt = 0; attempt < SLOT_CLAIM_ATTEMPTS; attempt++) {
      try {
        const db = await pgPool();
        const { rows } = await db.query(
          `INSERT INTO demo_claims (key, expires_at)
           SELECT $1 || s::text, now() + make_interval(secs => $3)
           FROM generate_series(1, $2) AS s
           WHERE NOT EXISTS (
             SELECT 1 FROM demo_claims c
             WHERE c.key = $1 || s::text AND c.expires_at > now()
           )
           ORDER BY s
           LIMIT 1
           ON CONFLICT (key) DO UPDATE
             SET expires_at = EXCLUDED.expires_at
             WHERE demo_claims.expires_at < now()
           RETURNING key`,
          [prefix, slots, ttlSecs]
        );
        markHealthy();
        if (rows.length > 0) return true;
        // No row means either a genuinely full window or a lost race for the
        // slot we picked. Retrying tells them apart for one extra query.
      } catch (e) {
        await enterDegraded(e);
        return emergencyGrant(prefix);
      }
    }
    return false;
  }
  for (let slot = 1; slot <= slots; slot++) {
    if (await claimKey(`${prefix}${slot}`, ttlSecs)) return true;
  }
  return false;
}

// Peek: has this IP already used today's free call?
export async function hasFreeAudit(ip) {
  return peekKey(dayKey(ip));
}

// Atomically claim today's free call. Returns false if already claimed —
// including by a concurrent request that won the race.
// Call AFTER a successful audit so failures don't burn the day's credit.
export async function markFreeAudit(ip) {
  return claimKey(dayKey(ip), secondsUntilUtcMidnight());
}

export function ipFromRequest(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// One place for the next-step copy, so a caller who runs out is never told
// only "you are out". No USDC wallet? The card path needs no account.
export const FREE_TIER_HELP =
  "Pay per call with x402 on Base mainnet — no account or API key needed. No USDC wallet? Buy a one-time human report by card ($9 Quick / $29 Deep) at https://www.santosautomation.com/agent-readiness/buy.";

/**
 * Quota gate for the one remaining free surface (the MCP preview tool).
 *
 * Returns { ok: false } to reject, or { ok: true, claim } where `claim` must be
 * called only after a successful result so a failure never burns the day.
 */
export async function openPreviewQuota(ip) {
  const key = dayKey(ip);
  if (!(await peekKey(key))) return { ok: false };
  return { ok: true, claim: () => claimKey(key, secondsUntilUtcMidnight()) };
}
