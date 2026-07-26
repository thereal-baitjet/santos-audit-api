// Buy one Link Map ($0.003 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-links.js https://example.com
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
const res = await fetchWithPay(`${BASE}/v1/links?url=${encodeURIComponent(target)}`);
const data = await res.json();
console.log("Status:", res.status);
if (res.status !== 200) { console.log(data); process.exit(1); }
console.log("Total links:", data.total_links, "| counts:", JSON.stringify(data.counts));
console.log("--- first links ---");
console.log(JSON.stringify(data.links?.slice(0, 10), null, 2));
