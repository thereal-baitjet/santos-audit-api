// Charge a finished crawl job for what it actually did, at most once.
//
// Called by the control plane after the worker marks a job terminal. Only
// completed jobs are charged; failed/cancelled/expired jobs and zero-cost jobs
// are voided without touching the chain. Retrying a settle is safe on-chain
// (the Permit2 nonce is single-use), but this function never retries itself:
// a job left in 'failed' needs an explicit reconcile.
import { getStore } from "./store.js";
import { TERMINAL_STATES } from "./schemas.js";

let initPromise = null;
async function defaultServer() {
  const { crawlResourceServer } = await import("./x402.js");
  initPromise ??= crawlResourceServer.initialize().catch((e) => { initPromise = null; throw e; });
  await initPromise;
  return crawlResourceServer;
}

/**
 * @returns the updated job, or null when the job is missing, not finished yet,
 *   or its settlement was already claimed by another caller.
 */
export async function settleCrawlJob(jobId, { store = getStore(), server, now = () => new Date() } = {}) {
  const current = await store.getJob(jobId);
  if (!current || !TERMINAL_STATES.includes(current.status)) return null;

  const claimed = await store.claimSettlement(jobId);
  if (!claimed) return null;
  const { job, paymentPayload, paymentRequirements } = claimed;

  const cost = BigInt(job.cost_atomic);
  if (job.status !== "completed" || cost === 0n) {
    const reason = job.status !== "completed" ? `job ${job.status}; not charged` : "no pages processed; not charged";
    return store.finishSettlement(jobId, { status: "voided", settledAtomic: "0", error: reason });
  }
  if (cost > BigInt(job.budget_atomic)) {
    return store.finishSettlement(jobId, { status: "failed", error: `cost ${cost} exceeds authorized ${job.budget_atomic}; refusing to settle` });
  }
  if (now() >= new Date(job.authorization_expires_at)) {
    return store.finishSettlement(jobId, { status: "failed", error: "payment authorization expired before settlement" });
  }

  try {
    const s = await (server ?? (await defaultServer())).settlePayment(
      paymentPayload, paymentRequirements, undefined, undefined, { amount: cost.toString() }
    );
    if (s?.success) {
      return store.finishSettlement(jobId, { status: "settled", settledAtomic: cost.toString(), tx: s.transaction ?? null });
    }
    return store.finishSettlement(jobId, { status: "failed", error: s?.errorReason ?? "facilitator declined settlement" });
  } catch (e) {
    return store.finishSettlement(jobId, { status: "failed", error: `settle error: ${String(e?.message ?? e).slice(0, 200)}` });
  }
}
