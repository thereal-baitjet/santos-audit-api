// Batch test: 10 sites, one $0.10 USDC x402 payment (buyer = seller, our own wallet).
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

process.loadEnvFile(".env.local");
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const urls = [
  "https://example.com",
  "https://en.wikipedia.org",
  "https://github.com",
  "https://stripe.com",
  "https://vercel.com",
  "https://supabase.com",
  "https://react.dev",
  "https://developer.mozilla.org",
  "https://www.w3.org",
  "https://news.ycombinator.com",
];

const res = await fetchWithPay("https://api.santosautomation.com/api/audit/batch", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ urls }),
});
const data = await res.json();
const receipt = res.headers.get("payment-response");
console.log("Status:", res.status);
if (receipt) {
  const s = JSON.parse(Buffer.from(receipt, "base64").toString("utf-8"));
  console.log("Settled tx:", s.transaction, "| payer:", s.payer);
}
console.log(`Batch: ${data.batch_size} urls, ${data.succeeded} ok, ${data.failed} failed\n`);
for (const r of data.results ?? []) {
  if (r.ok) {
    const rep = r.report;
    console.log(`${String(rep.overall_score).padStart(3)}/100  WI:${String(rep.website_intelligence_score).padStart(3)}  ${r.url}  issues: ${rep.issues.length}`);
  } else {
    console.log(`FAIL   ${r.url}  ${r.error.code}: ${r.error.message}`);
  }
}
