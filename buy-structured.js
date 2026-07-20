// Buy one Structured Extraction ($0.08 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-structured.js https://en.wikipedia.org/wiki/Web_scraping '{"type":"object","required":["title","summary"],"properties":{"title":{"type":"string"},"summary":{"type":"string"}}}'
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BASE ?? "https://api.santosautomation.com";
const target = process.argv[2] ?? "https://en.wikipedia.org/wiki/Web_scraping";
const schema = process.argv[3]
  ? JSON.parse(process.argv[3])
  : {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string", description: "The article title." },
        summary: { type: "string", description: "A one-paragraph summary of the article." },
      },
    };

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
const res = await fetchWithPay(`${BASE}/v1/extract/structured`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: target, schema }),
});
const data = await res.json();
console.log("Status:", res.status);
if (res.status !== 200) { console.log(data); process.exit(1); }
console.log("Model:", data.model, "| timing_ms:", JSON.stringify(data.timing_ms));
console.log("--- extracted data ---");
console.log(JSON.stringify(data.data, null, 2));
