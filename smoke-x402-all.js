// Run a single x402-backed smoke test across the three paid endpoints.
import { randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import dotenv from "dotenv";

dotenv.config();

const baseUrl = process.argv[2] || process.env.API_BASE_URL || "https://api.santosautomation.com";
const target = process.argv[3] || process.env.TEST_TARGET || "example.com";
const privateKey = process.env.BUYER_PRIVATE_KEY;

if (!privateKey) {
  console.error("Set BUYER_PRIVATE_KEY to a funded private key before running this smoke test.");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

async function callEndpoint(name, method, url, body = undefined) {
  const headers = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (name === "Deep page audit") {
    headers["idempotency-key"] = randomUUID();
  }

  console.log(`\n=== ${name} ===`);
  console.log(`URL: ${url}`);

  const res = await fetchWithPay(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  console.log(`status: ${res.status}`);
  console.log(`payment-response header: ${Boolean(res.headers.get("payment-response"))}`);
  console.log(JSON.stringify(payload, null, 2).slice(0, 2000));
}

const quickUrl = `${baseUrl}/api/audit?url=${encodeURIComponent(target)}`;
const readinessUrl = `${baseUrl}/api/agent-readiness?url=${encodeURIComponent(target)}&depth=quick`;
const deepUrl = `${baseUrl}/v1/audits`;
const deepBody = {
  url: `https://${target}`,
  devices: ["mobile"],
  modules: ["lighthouse", "accessibility", "browser-network", "security-passive"],
};

console.log(`Buyer wallet: ${account.address}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Target: ${target}`);

await callEndpoint("Quick audit", "GET", quickUrl);
await callEndpoint("Agent Readiness", "GET", readinessUrl);
await callEndpoint("Deep page audit", "POST", deepUrl, deepBody);
