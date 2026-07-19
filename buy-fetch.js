// Buy one Safe Fetch ($0.002 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-fetch.js https://example.com
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
const res = await fetchWithPay(`${BASE}/v1/fetch?url=${encodeURIComponent(target)}`);
const data = await res.json();
console.log("Status:", res.status);
if (res.status !== 200) { console.log(data); process.exit(1); }
console.log("Final URL:", data.final_url, "| status:", data.http_status, "| type:", data.content_type, "| bytes:", data.body_bytes);
console.log("--- body head ---");
console.log(data.body.slice(0, 300));
