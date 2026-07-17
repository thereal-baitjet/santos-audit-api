// Agent buys a $0.005 site audit via x402.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";
import dotenv from "dotenv";
dotenv.config();

const target = process.argv[2] ?? "example.com";
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPayment(fetch, account);

const res = await fetchWithPay(`http://localhost:3000/api/audit?url=${encodeURIComponent(target)}`);
const data = await res.json();
console.log("Status:", res.status);
console.log("Tier:", data.tier, "| Overall:", data.overall_score, "| Scores:", JSON.stringify(data.scores));
console.log("Issues:", JSON.stringify(data.issues, null, 2));
