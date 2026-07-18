// Buy one Deep Page Audit ($0.075 USDC via x402 v2), poll to completion, print the report.
//   BUYER_PRIVATE_KEY=0x... node buy-deep.js https://example.com
import { randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BASE ?? "https://api.santosautomation.com";
const target = process.argv[2] ?? "https://example.com";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
const res = await fetchWithPay(`${BASE}/v1/audits`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
  body: JSON.stringify({ url: target }),
});
const job = await res.json();
console.log("Create:", res.status, job.job_id ?? job.error);
if (!job.job_id) process.exit(1);

const auth = { headers: { Authorization: `Bearer ${job.access_token}` } };
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await (await fetch(job.status_url, auth)).json();
  console.log(`status=${s.status} stage=${s.stage ?? "-"} progress=${s.progress}%`);
  if (["completed", "failed", "expired", "cancelled"].includes(s.status)) break;
}

const reportRes = await fetch(job.report_url, auth);
const report = await reportRes.json();
if (reportRes.status !== 200) { console.log("No report:", report); process.exit(1); }
console.log("\nScores:", JSON.stringify(report.scores));
console.log("Findings:", report.findings.length);
console.log("Artifacts:", report.artifacts.map((a) => `${a.type} -> ${a.download_url}`).join("\n           "));
