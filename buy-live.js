// Paid x402 v2 audit against the LIVE production API.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
console.log("Buying audit from https://api.santosautomation.com ...");
const res = await fetchWithPay("https://api.santosautomation.com/api/audit?url=example.com");
const d = await res.json();
console.log("Status:", res.status, "| tier:", d.tier, "| overall:", d.overall_score);
console.log("Scores:", JSON.stringify(d.scores));
console.log("Receipt header present:", !!res.headers.get("payment-response"));
