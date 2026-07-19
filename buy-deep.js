// Buy one Deep Page Audit ($0.075 USDC via x402 v2), poll to completion, print the report.
//   BUYER_PRIVATE_KEY=0x... node buy-deep.js https://example.com
import { randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

export const DEFAULT_BASE = process.env.BASE ?? "https://api.santosautomation.com";

// Build a payment-wrapped fetch and the agent account from BUYER_PRIVATE_KEY.
// Reused across repeated calls so every buy settles from a single wallet.
export function createPaidFetch() {
  const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });
  return { account, fetchWithPay };
}

// Run one Deep Page Audit end-to-end: create the paid job, poll it, fetch the report.
// Returns a structured result instead of exiting, so callers can run it repeatedly.
export async function runDeepAudit({
  target = "https://example.com",
  base = DEFAULT_BASE,
  fetchWithPay,
  log = () => {},
} = {}) {
  if (!fetchWithPay) ({ fetchWithPay } = createPaidFetch());

  const res = await fetchWithPay(`${base}/v1/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ url: target }),
  });
  const job = await res.json();
  log(`Create: ${res.status} ${job.job_id ?? job.error}`);
  if (!job.job_id) {
    return { ok: false, target, status: res.status, error: job.error ?? "no job_id" };
  }

  const auth = { headers: { Authorization: `Bearer ${job.access_token}` } };
  let s = { status: "unknown" };
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    s = await (await fetch(job.status_url, auth)).json();
    log(`status=${s.status} stage=${s.stage ?? "-"} progress=${s.progress}%`);
    if (["completed", "failed", "expired", "cancelled"].includes(s.status)) break;
  }

  const reportRes = await fetch(job.report_url, auth);
  const report = await reportRes.json();
  if (reportRes.status !== 200) {
    return { ok: false, target, jobId: job.job_id, status: s.status, error: report };
  }

  return {
    ok: s.status === "completed",
    target,
    jobId: job.job_id,
    status: s.status,
    scores: report.scores,
    findings: report.findings.length,
    artifacts: report.artifacts.map((a) => ({ type: a.type, download_url: a.download_url })),
  };
}

// CLI: buy a single deep audit for the URL passed as the first argument.
async function main() {
  const target = process.argv[2] ?? "https://example.com";
  const { account, fetchWithPay } = createPaidFetch();
  console.log("Agent wallet:", account.address);

  const result = await runDeepAudit({ target, fetchWithPay, log: (m) => console.log(m) });
  if (!result.ok) {
    console.log("No report:", result.error);
    process.exit(1);
  }
  console.log("\nScores:", JSON.stringify(result.scores));
  console.log("Findings:", result.findings);
  console.log(
    "Artifacts:",
    result.artifacts.map((a) => `${a.type} -> ${a.download_url}`).join("\n           "),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
