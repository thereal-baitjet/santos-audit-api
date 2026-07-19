// Wake-per-job capacity: start the stopped Fly worker machine when a paid deep
// job arrives. Env-gated — with no FLY_API_TOKEN the deep tier falls back to
// heartbeat-only (a live laptop/launchd worker), unchanged behavior.
const APP = process.env.FLY_WORKER_APP ?? "santos-audit-worker";
const TOKEN = process.env.FLY_API_TOKEN;
const API = "https://api.machines.dev/v1";

export const flyWakeConfigured = () => Boolean(TOKEN);

async function flyFetch(path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...init.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Returns true when at least one worker machine is running or was just
// started — i.e. capacity is guaranteed to exist for the accepted job.
export async function wakeFlyWorker() {
  const listRes = await flyFetch(`/apps/${APP}/machines`);
  if (!listRes.ok) throw new Error(`fly list machines: ${listRes.status}`);
  const machines = await listRes.json();
  if (!Array.isArray(machines) || machines.length === 0) return false;

  if (machines.some((m) => m.state === "started" || m.state === "starting")) return true;

  let woke = false;
  for (const m of machines.filter((m) => m.state === "stopped" || m.state === "suspended")) {
    const res = await flyFetch(`/apps/${APP}/machines/${m.id}/start`, { method: "POST" });
    if (res.ok) woke = true;
    else console.error(`fly start ${m.id} failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
  return woke;
}
