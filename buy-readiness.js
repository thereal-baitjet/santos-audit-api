// Buy one Agent Readiness audit ($0.075 USDC via x402 v2) against production.
//   BUYER_PRIVATE_KEY=0x... node buy-readiness.js https://example.com
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
const res = await fetchWithPay(`${BASE}/api/agent-readiness?url=${encodeURIComponent(target)}&depth=quick`);
const data = await res.json();
console.log("Status:", res.status);
console.log(JSON.stringify(data, null, 2).slice(0, 2000));
