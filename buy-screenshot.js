// Buy one Screenshot/PDF render ($0.01 USDC via x402 v2).
//   BUYER_PRIVATE_KEY=0x... node buy-screenshot.js https://example.com [png|jpeg|pdf]
import { writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.BASE ?? "https://api.santosautomation.com";
const target = process.argv[2] ?? "https://example.com";
const format = process.argv[3] ?? "png";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

console.log("Agent wallet:", account.address);
const res = await fetchWithPay(`${BASE}/v1/screenshot?url=${encodeURIComponent(target)}&format=${format}`);
console.log("Status:", res.status, "| type:", res.headers.get("content-type"), "| job:", res.headers.get("x-render-job"));
if (res.status !== 200) { console.log(await res.text()); process.exit(1); }
const bytes = Buffer.from(await res.arrayBuffer());
const file = `/tmp/render.${format === "jpeg" ? "jpg" : format}`;
writeFileSync(file, bytes);
console.log(`Saved ${bytes.length} bytes -> ${file}`);
