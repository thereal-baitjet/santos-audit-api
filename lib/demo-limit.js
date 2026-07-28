// Shared free-tier limiter: 1 audit per IP per day, across the demo route and
// the MCP preview tool.
//
// Storage adapters:
//  - Upstash Redis (RATE_LIMIT_STORE_URL + RATE_LIMIT_STORE_TOKEN): durable
//    across cold starts and instances. Claims use atomic SET NX EX, so
//    concurrent requests cannot double-spend the daily allowance.
//  - In-memory Map (fallback): per-instance only; fine for local dev/tests.
//
// On storage outage the limiter enters DEGRADED mode: a small in-process
// emergency allowance per key, one ops alert, and denial past the cap. It no
// longer fails fully open — see the degraded-mode section below.
//
// Privacy: IPs are HMAC-hashed with RATE_LIMIT_HASH_SECRET before being used
// as storage keys, so raw addresses never persist.
import { createHmac } from "node:crypto";
import { requireSecret } from "./required-env.js";

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

// ---------------------------------------------------------------------------
// Degraded mode.
//
// The limiter used to fail fully open: a storage outage meant unlimited free
// audits, which on a public browser-capable service is an invitation to abuse
// at exactly the moment we cannot measure it. It now falls back to a small
// in-process allowance instead, alerts once, and denies past the cap.
//
// Honest limitation: this counter is per serverless instance, so the effective
// ceiling during an outage is EMERGENCY_MAX × live instances, not a global
// number. That is bounded and alertable, which unlimited was not — it is a
// blast-radius reduction, not a precise quota.
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
        "The rate-limit store is unreachable, so free-tier quota cannot be enforced durably. " +
        "Serving continues on a bounded emergency allowance; heavy LLM-backed free work is refused outright.",
      fields: [
        { name: "Cause", value: degradedReason ?? "unknown" },
        { name: "Emergency allowance", value: `${EMERGENCY_MAX} per key per instance, then denied`, inline: true },
        { name: "Degraded since", value: degradedSince ?? "just now", inline: true },
        {
          name: "Check first",
          value:
            "1. Supabase/Postgres reachability (DATABASE_URL)\n" +
            "2. Upstash, if RATE_LIMIT_STORE_URL is configured\n" +
            "3. https://www.santosautomation.com/status",
        },
        { name: "Exposure while degraded", value: "Free tier only. Paid x402 routes are unaffected — they never depend on this limiter." },
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
      return (await redis(["EXISTS", key])) === 0;
    } catch (e) {
      await enterDegraded(e);
      return emergencyHasRoom(key);
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
      await enterDegraded(e);
      return emergencyHasRoom(key);
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
      await enterDegraded(e);
      return emergencyGrant(key);
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
      await enterDegraded(e);
      return emergencyGrant(key);
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

// One claim per verified email per UTC day — the same shared-quota philosophy
// as the IP key, keyed on the HMAC'd email instead.
export function dailyEmailKey(email) {
  return `demo:${new Date().toISOString().slice(0, 10)}:email:${hashIdentity(email)}`;
}

// One place for the free-tier next-step copy, so a caller who runs out is never
// told only "you are out". Free token first: it costs the caller nothing, keeps
// them in the product, and is the only step that captures who they are.
export const FREE_TIER_HELP =
  "Get your own daily quota with a free verified-email token at https://www.santosautomation.com/free-token (no card, valid 30 days), then pass it as &token=… . No USDC wallet? Buy a one-time human report by card ($9 Quick / $29 Deep) at https://www.santosautomation.com/agent-readiness/buy.";

export const INVALID_TOKEN_HELP =
  "That token is not valid or has expired. Issue a new one at https://www.santosautomation.com/free-token — or omit &token= to fall back to the shared per-IP quota.";

/**
 * Quota gate for the HTTP demo endpoints, matching the MCP tools' rules: an
 * optional `?token=` moves today's allowance off the shared IP and onto that
 * verified user.
 *
 * Returns { ok: false, reason } to reject, or { ok: true, identity, claim }
 * where `claim` must be called only after a successful response so a failure
 * never burns the day's allowance.
 */
export async function openDemoQuota(req, { heavy = false } = {}) {
  // While the limiter cannot enforce durably, refuse the expensive free paths
  // entirely rather than spend LLM tokens we cannot account for.
  if (heavy && limiterStatus().degraded) return { ok: false, reason: "degraded" };
  const token = req.nextUrl?.searchParams?.get("token") ?? "";
  const { key, identity } = await resolveFreeQuota({ token, ip: ipFromRequest(req) });
  if (!key) return { ok: false, reason: "invalid_token" };
  if (!(await peekKey(key))) return { ok: false, reason: "rate_limited", identity };
  return { ok: true, identity, claim: () => claimKey(key, secondsUntilUtcMidnight()) };
}

// Decide which identity today's free call is charged against.
//
// IP is the wrong identity for a hosted agent. Grok, and any other platform
// that calls this server from its own infrastructure, egresses from a small
// set of shared addresses — so an IP-keyed quota collapses to one free call
// per day for every user of that platform combined, no matter how high the
// limit is set. A verified-email token lets an individual user bring their own
// identity and their own daily allowance.
//
// Returns { key, identity }. `key` is null when a token was supplied but did
// not verify; callers must reject rather than silently falling back to the IP,
// or an invalid token would be a free way to dodge someone else's spent quota.
export async function resolveFreeQuota({ token, ip }) {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) return { key: dayKey(ip), identity: "ip" };
  // Imported lazily so the IP-only paths never pull in the leads store.
  const { verifyToken } = await import("./leads/verify.js");
  const email = await verifyToken(trimmed);
  if (!email) return { key: null, identity: "invalid_token" };
  return { key: dailyEmailKey(email), identity: "email" };
}
