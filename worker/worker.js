// Santos Deep Audit worker: polls the Postgres queue, runs one audit at a
// time in this process, writes report + artifacts back. No inbound network
// surface; holds only DATABASE_URL (+ optional ANTHROPIC_API_KEY) — never
// payment, facilitator, or deployment secrets.
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { getStore, hasDatabase } from "../lib/deep/store.js";
import { validateTarget, assertPublicHost } from "../lib/safe-fetch.js";
import { runDeepAudit } from "./run-audit.js";
import { runScreenshot } from "./run-screenshot.js";

const WORKER_ID = `${hostname()}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const JOB_TIMEOUT_MS = Number(process.env.WORKER_JOB_TIMEOUT_SECONDS ?? 300) * 1000;
const CLEANUP_EVERY = 50;
// Wake-per-job mode (Fly): exit 0 after this much idle time so the machine
// stops billing; the API starts it again when the next paid job arrives.
// 0 (default) = run forever — the right mode for the laptop/launchd worker.
const IDLE_EXIT_MS = Number(process.env.WORKER_IDLE_EXIT_SECONDS ?? 0) * 1000;

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

    const run = job.request.profile === "screenshot" ? runScreenshot : runDeepAudit;
    const { report, artifacts } = await withTimeout(run(job.request, heartbeat), JOB_TIMEOUT_MS);

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

console.log(JSON.stringify({ worker: WORKER_ID, msg: "worker online", poll_ms: POLL_MS, idle_exit_s: IDLE_EXIT_MS / 1000 }));
let lastWorkAt = Date.now();
for (;;) {
  if (shuttingDown) { console.log(JSON.stringify({ worker: WORKER_ID, msg: "drained, exiting" })); process.exit(0); }
  if (IDLE_EXIT_MS && Date.now() - lastWorkAt > IDLE_EXIT_MS) {
    console.log(JSON.stringify({ worker: WORKER_ID, msg: "idle limit reached, exiting" }));
    process.exit(0);
  }
  try {
    // Liveness beat first: the API only accepts (and charges for) new jobs
    // while some worker has beaten recently or can be woken on demand.
    await store.workerHeartbeat(WORKER_ID);
    const job = await store.leaseNextJob(WORKER_ID);
    if (job) {
      await processJob(job);
      lastWorkAt = Date.now();
    } else {
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (++pollCount % CLEANUP_EVERY === 0) await store.cleanup();
  } catch (e) {
    console.error(JSON.stringify({ worker: WORKER_ID, msg: `loop error: ${e.message}` }));
    await new Promise((r) => setTimeout(r, POLL_MS * 2));
  }
}
