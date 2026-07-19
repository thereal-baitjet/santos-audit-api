// Shared worker-capacity check for every browser-backed paid product.
// Capacity = a fresh worker heartbeat, OR the stopped Fly machine can be
// started right now (wake-per-job). Callers 503 (unsettled) when false.
import { getStore } from "./store.js";
import { flyWakeConfigured, wakeFlyWorker } from "./fly-wake.js";

export async function hasWorkerCapacity() {
  let capacity = await getStore().workerAlive();
  if (!capacity && flyWakeConfigured()) {
    capacity = await wakeFlyWorker().catch((e) => {
      console.error("fly wake failed:", e.message);
      return false;
    });
  }
  return capacity;
}
