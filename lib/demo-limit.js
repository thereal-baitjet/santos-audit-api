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

const memoryLog = new Map(); // key -> date string (fallback adapter)

function dayKey(ip) {
  const hashed = createHmac("sha256", HASH_SECRET).update(ip).digest("hex").slice(0, 32);
  return `demo:${new Date().toISOString().slice(0, 10)}:${hashed}`;
}

function secondsUntilUtcMidnight() {
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

// Peek: has this IP already used today's free audit?
export async function hasFreeAudit(ip) {
  const key = dayKey(ip);
  if (STORE_URL && STORE_TOKEN) {
    try {
      return (await redis(["EXISTS", key])) === 0;
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  return memoryLog.get(key) === undefined;
}

// Atomically claim today's free audit. Returns false if already claimed —
// including by a concurrent request that won the race.
// Call AFTER a successful audit so failures don't burn the day's credit.
export async function markFreeAudit(ip) {
  const key = dayKey(ip);
  if (STORE_URL && STORE_TOKEN) {
    try {
      // SET key 1 NX EX <ttl>: only one caller per key per day gets "OK".
      return (await redis(["SET", key, "1", "NX", "EX", String(secondsUntilUtcMidnight())])) === "OK";
    } catch (e) {
      console.error("rate-limit store unavailable (failing open):", e.message);
      return true;
    }
  }
  if (memoryLog.get(key) !== undefined) return false;
  memoryLog.set(key, "1");
  return true;
}

export function ipFromRequest(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
