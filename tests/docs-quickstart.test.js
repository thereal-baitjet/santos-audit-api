import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";
import { docsQuickstart } from "../lib/docs-quickstart.js";

const root = fileURLToPath(new URL("..", import.meta.url));

// Execute the exact displayed source with the installed SDK, an ephemeral
// unfunded key, and a fully mocked fetch. No RPC, API call, or payment is sent.
function runQuickstart({ privateKey = generatePrivateKey(), network = "eip155:8453", status = 200 } = {}) {
  const fixture = `
import assert from "node:assert/strict";
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader } from "@x402/core/http";
const requirements = {
  scheme: "exact", network: ${JSON.stringify(network)}, amount: "15000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0x0000000000000000000000000000000000000001",
  maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" },
};
let calls = 0;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  assert.equal(request.url, "https://api.santosautomation.com/api/audit?url=https%3A%2F%2Fexample.com");
  assert.equal(request.method, "GET");
  calls += 1;
  if (calls === 1) {
    assert.equal(request.headers.has("PAYMENT-SIGNATURE"), false);
    return new Response(null, {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encodePaymentRequiredHeader({
        x402Version: 2, resource: { url: request.url }, accepts: [requirements],
      }) },
    });
  }
  assert.equal(calls, 2, "the SDK must retry once with the signed authorization");
  const payment = decodePaymentSignatureHeader(request.headers.get("PAYMENT-SIGNATURE"));
  assert.equal(payment.x402Version, 2);
  assert.deepEqual(payment.accepted, requirements);
  assert.equal(payment.payload.authorization.from.toLowerCase(), account.address.toLowerCase());
  assert.equal(payment.payload.authorization.to, requirements.payTo);
  assert.equal(payment.payload.authorization.value, requirements.amount);
  assert.match(payment.payload.signature, /^0x[0-9a-f]{130}$/i);
  return Response.json({ overall_score: 82, mocked: true }, { status: ${status} });
};
`;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", fixture + "\n" + docsQuickstart], {
    cwd: root,
    env: { BUYER_PRIVATE_KEY: privateKey },
    encoding: "utf8",
    timeout: 10000,
  });
}

test("docs quickstart handles a real SDK 402 challenge and signed Base retry", () => {
  const result = runQuickstart();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { overall_score: 82, mocked: true });
});

test("docs quickstart reports HTTP errors instead of treating them as paid reports", () => {
  const result = runQuickstart({ status: 503 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Audit request failed: HTTP 503/);
  assert.equal(result.stdout, "");
});

test("docs quickstart only registers Base mainnet", () => {
  const result = runQuickstart({ network: "eip155:84532" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No network\/scheme registered/);
  assert.equal(result.stdout, "");
});

test("docs quickstart explains missing or placeholder private keys", () => {
  for (const privateKey of ["", "0xYOUR_PRIVATE_KEY"]) {
    const result = runQuickstart({ privateKey });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set BUYER_PRIVATE_KEY to your 0x-prefixed, 32-byte wallet private key/);
    assert.equal(result.stdout, "");
  }
});
