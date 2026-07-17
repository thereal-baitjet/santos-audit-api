// Agent buys a $0.005 site audit via x402 v2 (local dev server).
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const target = process.argv[2] ?? "example.com";
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay(`http://localhost:3000/api/audit?url=${encodeURIComponent(target)}`);
const data = await res.json();
console.log("Status:", res.status);
console.log("Tier:", data.tier, "| Overall:", data.overall_score, "| Scores:", JSON.stringify(data.scores));
console.log("Issues:", JSON.stringify(data.issues, null, 2));
