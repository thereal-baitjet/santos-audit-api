// Buy one Page Summary ($0.033 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-summarize.js https://example.com/article ["pricing plans"]
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BASE ?? "https://api.santosautomation.com";
const target = process.argv[2] ?? "https://example.com";
const focus = process.argv[3];

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
const res = await fetchWithPay(`${BASE}/v1/summarize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(focus ? { url: target, focus } : { url: target }),
});
const data = await res.json();
console.log("Status:", res.status);
if (res.status !== 200) { console.log(data); process.exit(1); }
console.log("Title:", data.title, "| model:", data.model, "| words:", data.word_count);
console.log("--- summary ---");
console.log(data.summary);
console.log("--- key facts ---");
console.log(JSON.stringify(data.key_facts, null, 2));
console.log("--- entities ---");
console.log(JSON.stringify(data.entities, null, 2));
