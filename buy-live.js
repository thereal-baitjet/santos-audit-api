// Step 4: paid x402 audit against the LIVE production API.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";
import dotenv from "dotenv";
dotenv.config();

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPayment(fetch, account);

console.log("Agent wallet:", account.address);
console.log("Buying audit from https://www.santosautomation.com ...");
const res = await fetchWithPay("https://www.santosautomation.com/api/audit?url=example.com");
const d = await res.json();
console.log("Status:", res.status, "| tier:", d.tier, "| overall:", d.overall_score);
console.log("Scores:", JSON.stringify(d.scores));
console.log("Receipt header present:", !!res.headers.get("x-payment-response"));
