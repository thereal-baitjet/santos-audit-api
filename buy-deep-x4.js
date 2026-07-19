// Run the $0.075 Deep Page Audit call four times from a single agent wallet.
//   BUYER_PRIVATE_KEY=0x... node buy-deep-x4.js [url1 url2 ...]
//
// Defaults to 4 runs against https://example.com. Any URLs you pass become the
// targets; if you pass fewer than COUNT, the list is cycled to fill the count.
// Options (env):
//   COUNT=4        how many times to run the call (default 4)
//   SERIAL=1       run one at a time instead of all at once
//   BASE=...       override the API base URL
import { createPaidFetch, runDeepAudit } from "./buy-deep.js";

const COUNT = Number(process.env.COUNT ?? 4);
const SERIAL = process.env.SERIAL === "1" || process.argv.includes("--serial");

const urls = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = Array.from({ length: COUNT }, (_, i) =>
  urls.length ? urls[i % urls.length] : "https://example.com",
);

const { account, fetchWithPay } = createPaidFetch();
console.log(`Agent wallet: ${account.address}`);
console.log(`Running the $0.075 deep-audit call ${COUNT}x (${SERIAL ? "serial" : "parallel"})\n`);

// Run one numbered call, prefixing every progress line with its slot.
async function runOne(target, n) {
  const tag = `[${n}/${COUNT}]`;
  console.log(`${tag} start -> ${target}`);
  try {
    const result = await runDeepAudit({
      target,
      fetchWithPay,
      log: (m) => console.log(`${tag} ${m}`),
    });
    console.log(`${tag} done  status=${result.status} ok=${result.ok}`);
    return { n, ...result };
  } catch (err) {
    console.log(`${tag} error ${err.message}`);
    return { n, ok: false, target, status: "error", error: err.message };
  }
}

let results;
if (SERIAL) {
  results = [];
  for (let i = 0; i < targets.length; i++) {
    results.push(await runOne(targets[i], i + 1));
  }
} else {
  results = await Promise.all(targets.map((t, i) => runOne(t, i + 1)));
}

const ok = results.filter((r) => r.ok).length;
console.log(`\nSummary: ${ok}/${COUNT} completed`);
for (const r of results) {
  const detail = r.ok
    ? `job=${r.jobId} scores=${JSON.stringify(r.scores)} findings=${r.findings}`
    : `FAILED status=${r.status} ${JSON.stringify(r.error)}`;
  console.log(`  [${r.n}] ${r.target} -> ${detail}`);
}

process.exit(ok === COUNT ? 0 : 1);
