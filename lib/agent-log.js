// Fire-and-forget traffic logging into public.agent_logs for the admin
// Traffic Control dashboard (/admin/dashboard streams INSERTs via Supabase
// realtime). Wrap a route's exported handler with withAgentLog(handler, label).
//
// Design constraints:
//  - Zero added latency: the insert runs in next/server after(), post-response.
//  - Never breaks a route: every failure path is swallowed (a paid audit must
//    not fail because the log table hiccuped).
//  - No raw IPs stored: only a salted sha256 prefix for coarse dedup.
//  - No-ops when DATABASE_URL is unset (local dev/tests without a database).
import { after } from "next/server";
import { createHash } from "node:crypto";

let pgPool = null;
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
  return pgPool;
}

// Ordered: most specific first. Names follow each vendor's published UA token.
const AGENT_SIGNATURES = [
  ["gptbot", "GPTBot"],
  ["oai-searchbot", "OAI-SearchBot"],
  ["chatgpt-user", "ChatGPT-User"],
  ["claudebot", "ClaudeBot"],
  ["claude-user", "Claude-User"],
  ["claude-searchbot", "Claude-SearchBot"],
  ["claude-code", "Claude-Code"],
  ["perplexitybot", "PerplexityBot"],
  ["perplexity-user", "Perplexity-User"],
  ["google-extended", "Google-Extended"],
  ["googleother", "GoogleOther"],
  ["googlebot", "Googlebot"],
  ["bingbot", "Bingbot"],
  ["duckassistbot", "DuckAssistBot"],
  ["applebot", "Applebot"],
  ["amazonbot", "Amazonbot"],
  ["meta-externalagent", "Meta-ExternalAgent"],
  ["facebookbot", "FacebookBot"],
  ["bytespider", "Bytespider"],
  ["ccbot", "CCBot"],
  ["cohere", "Cohere"],
  ["mistral", "Mistral"],
  ["diffbot", "Diffbot"],
  ["x402", "x402-client"],
  ["python-requests", "python-requests"],
  ["python-httpx", "python-httpx"],
  ["aiohttp", "aiohttp"],
  ["curl/", "curl"],
  ["wget/", "wget"],
  ["go-http-client", "Go-http-client"],
  ["axios", "axios"],
  ["node-fetch", "node-fetch"],
  ["undici", "undici"],
  ["okhttp", "okhttp"],
];

function agentNameFrom(ua) {
  if (!ua) return "no-user-agent";
  const lower = ua.toLowerCase();
  for (const [needle, name] of AGENT_SIGNATURES) {
    if (lower.includes(needle)) return name;
  }
  if (lower.startsWith("mozilla/")) return "browser";
  return ua.split(/[\s/]/, 1)[0].slice(0, 40) || "unknown";
}

function ipHashFrom(req) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? "santos-agent-log";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

async function insertLog(req, status, label) {
  if (!process.env.DATABASE_URL) return;
  try {
    const ua = req.headers.get("user-agent");
    const path = req.nextUrl?.pathname ?? new URL(req.url).pathname;
    const insert = (await pg()).query(
      `insert into agent_logs (agent_name, user_agent, method, path, status, ip_hash, country, referer, meta)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        agentNameFrom(ua),
        ua?.slice(0, 400) ?? null,
        req.method,
        path.slice(0, 300),
        Number.isInteger(status) ? status : null,
        ipHashFrom(req),
        req.headers.get("x-vercel-ip-country"),
        req.headers.get("referer")?.slice(0, 300) ?? null,
        JSON.stringify({ label }),
      ]
    );
    // Bounded wait: if the pool is wedged, drop the log line, not the lambda.
    await Promise.race([insert, new Promise((resolve) => setTimeout(resolve, 2500))]);
  } catch (e) {
    console.warn(`agent-log insert failed (${label}):`, e.message);
  }
}

function scheduleLog(req, status, label) {
  try {
    after(() => insertLog(req, status, label));
  } catch {
    // Outside a request scope (unit tests) after() throws — log inline instead.
    void insertLog(req, status, label);
  }
}

export function withAgentLog(handler, label) {
  return async function logged(req, ctx) {
    let res;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      scheduleLog(req, 500, label);
      throw err;
    }
    scheduleLog(req, res?.status ?? 200, label);
    return res;
  };
}
