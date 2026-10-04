// Render and execute the same example so the docs cannot drift from the SDK.
export const docsQuickstart = `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.BUYER_PRIVATE_KEY;
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey ?? "")) {
  throw new Error("Set BUYER_PRIVATE_KEY to your 0x-prefixed, 32-byte wallet private key.");
}
const account = privateKeyToAccount(privateKey);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay(
  "https://api.santosautomation.com/api/audit?url=https%3A%2F%2Fexample.com"
);
if (!res.ok) {
  throw new Error("Audit request failed: HTTP " + res.status);
}
const report = await res.json();
console.log(JSON.stringify(report, null, 2));`;
