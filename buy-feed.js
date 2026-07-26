// Buy one Feed Parse ($0.003 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-feed.js https://example.com/feed.xml
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BASE ?? "https://api.santosautomation.com";
const target = process.argv[2] ?? "https://example.com/feed.xml";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
const res = await fetchWithPay(`${BASE}/v1/feed?url=${encodeURIComponent(target)}`);
const data = await res.json();
console.log("Status:", res.status);
if (res.status !== 200) { console.log(data); process.exit(1); }
console.log("Format:", data.format, "| title:", data.feed?.title, "| items:", data.item_count);
console.log("--- first items ---");
console.log(JSON.stringify(data.items?.slice(0, 5), null, 2));
