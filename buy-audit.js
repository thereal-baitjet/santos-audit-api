// Agent buys a $0.015 site audit via x402 v2 (local dev server).
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { validateUrlForPurchase, ValidationError } from "./lib/validate-url.js";
import dotenv from "dotenv";
dotenv.config();

const target = process.argv[2] ?? "example.com";
const BASE = process.env.BASE ?? "https://api.santosautomation.com";

try {
  validateUrlForPurchase(target);
} catch (e) {
  console.error(`❌ ${e.code}: ${e.message}`);
  process.exit(1);
}

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay(`${BASE}/api/audit?url=${encodeURIComponent(target)}`);
const data = await res.json();

console.log("\n⏱️  TIMING DATA:");
console.log("X-Response-Time:", res.headers.get("X-Response-Time"));
console.log("X-Stage-Timings:", res.headers.get("X-Stage-Timings"));

console.log("\n📊 AUDIT RESULTS:");
console.log("Status:", res.status);
console.log("Tier:", data.tier, "| Overall:", data.overall_score, "| Scores:", JSON.stringify(data.scores));
console.log("Issues:", JSON.stringify(data.issues, null, 2));
