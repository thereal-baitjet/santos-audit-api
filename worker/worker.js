// Santos Deep Audit worker: polls the Postgres queue, runs one audit at a
// time in this process, writes report + artifacts back. No inbound network
// surface; holds only DATABASE_URL (+ optional ANTHROPIC_API_KEY) — never
// payment, facilitator, or deployment secrets.
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { getStore, hasDatabase } from "../lib/deep/store.js";
import { validateTarget, assertPublicHost } from "../lib/safe-fetch.js";
import { runDeepAudit } from "./run-audit.js";

const WORKER_ID = `${hostname()}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const JOB_TIMEOUT_MS = Number(process.env.WORKER_JOB_TIMEOUT_SECONDS ?? 300) * 1000;
const CLEANUP_EVERY = 50;

if (!hasDatabase()) {
  console.error("DATABASE_URL is required for the worker. Exiting.");
  process.exit(1);
}

const store = getStore();
let shuttingDown = false;
let pollCount = 0;

process.on("SIGTERM", () => { shuttingDown = true; });
process.on("SIGINT", () => { shuttingDown = true; });

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`job exceeded ${ms}ms limit`), { code: "AUDIT_TIMEOUT" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function processJob(job) {
  const log = (msg) => console.log(JSON.stringify({ worker: WORKER_ID, job: job.id, msg, at: new Date().toISOString() }));
  log(`starting attempt ${job.attempts}`);

  const heartbeat = async (stage, progress) => {
    if (await store.isCancelled(job.id)) throw Object.assign(new Error("cancelled"), { code: "CANCELLED" });
    await store.heartbeat(job.id, stage, progress ?? job.progress);
  };

  try {
    // Re-validate the target at execution time (DNS may have changed since accept).
    await heartbeat("validating-target", 5);
    validateTarget(job.request.url);
    await assertPublicHost(new URL(job.request.url).hostname);

    const { report, artifacts } = await withTimeout(runDeepAudit(job.request, heartbeat), JOB_TIMEOUT_MS);

    await heartbeat("storing-artifacts", 95);
    const reportId = `rpt_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    await store.completeJob(job.id, reportId, report, artifacts);
    log(`completed in ${report.duration_ms}ms — overall ${report.scores?.overall ?? "n/a"}`);
  } catch (e) {
    const code = e.code ?? "AUDIT_FAILED";
    if (code === "CANCELLED") { log("job cancelled mid-run"); return; }
    // Target-side failures are terminal (retrying won't fix their site);
    // infra-side failures retry up to the attempt cap.
    const targetSide = ["AUDIT_TIMEOUT", "TARGET_UNREACHABLE", "PRIVATE_ADDRESS_BLOCKED", "INVALID_URL", "UNSUPPORTED_SCHEME", "UNSUPPORTED_PORT"].includes(code);
    log(`failed: ${code}: ${e.message}`);
    await store.failJob(job.id, code, e.message, !targetSide);
  }
}

console.log(JSON.stringify({ worker: WORKER_ID, msg: "worker online", poll_ms: POLL_MS }));
for (;;) {
  if (shuttingDown) { console.log(JSON.stringify({ worker: WORKER_ID, msg: "drained, exiting" })); process.exit(0); }
  try {
    const job = await store.leaseNextJob(WORKER_ID);
    if (job) {
      await processJob(job);
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (++pollCount % CLEANUP_EVERY === 0) await store.cleanup();
  } catch (e) {
    console.error(JSON.stringify({ worker: WORKER_ID, msg: `loop error: ${e.message}` }));
    await new Promise((r) => setTimeout(r, POLL_MS * 2));
  }
}
