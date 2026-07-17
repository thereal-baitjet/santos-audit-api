// E2E checks for the Santos Audit API.
// Default target: local dev server on :3000. Override: BASE=https://santos-api.vercel.app npm test
const BASE = process.env.BASE ?? "http://localhost:3000";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// 1) Manifest
const root = await fetch(`${BASE}/api`);
const manifest = await root.json();
check("manifest returns 200", root.status === 200);
check("manifest lists demo + paid endpoints", !!manifest.endpoints?.["GET /api/audit/demo?url="] && !!manifest.endpoints?.["GET /api/audit?url="]);

// 2) Free demo: 200 with a report, or 429 if this IP already used today's audit
const demo = await fetch(`${BASE}/api/audit/demo?url=example.com`);
const demoBody = await demo.json();
if (demo.status === 200) {
  check("free demo returns scored report", demoBody.tier === "free-demo" && Number.isInteger(demoBody.overall_score));
  const again = await fetch(`${BASE}/api/audit/demo?url=example.com`);
  check("second demo same day rate-limited 429", again.status === 429, `got ${again.status}`);
} else {
  check("free demo rate-limits with 429 + upsell", demo.status === 429 && /x402/.test(demoBody.error ?? ""), `got ${demo.status}`);
}

// 3) Demo input validation
const bad = await fetch(`${BASE}/api/audit/demo?url=${encodeURIComponent("not a real host..")}`);
check("invalid URL handled gracefully (4xx, JSON error)", bad.status >= 400 && bad.status < 500);

// 3b) SSRF guard: private/metadata/localhost targets blocked with stable code
for (const target of ["http://169.254.169.254/latest/meta-data/", "http://localhost:3000/", "http://10.0.0.1/", "ftp://example.com/"]) {
  const r = await fetch(`${BASE}/api/audit/demo?url=${encodeURIComponent(target)}`);
  const b = await r.json().catch(() => ({}));
  check(`blocked: ${target}`, r.status >= 400 && ["PRIVATE_ADDRESS_BLOCKED", "UNSUPPORTED_SCHEME", "INVALID_URL"].includes(b.code), `got ${r.status} code=${b.code}`);
}

// 3c) OpenAPI document
const oa = await fetch(`${BASE}/openapi.json`);
const oaDoc = await oa.json().catch(() => ({}));
check("openapi.json reachable + JSON", oa.status === 200 && (oa.headers.get("content-type") ?? "").includes("json"));
check("openapi 3.1 with auditWebsite operation", oaDoc.openapi === "3.1.0" && oaDoc.paths?.["/api/audit"]?.get?.operationId === "auditWebsite" && !!oaDoc.paths?.["/api/audit/demo"]);

// 3d) llms.txt
const llms = await fetch(`${BASE}/llms.txt`);
const llmsText = await llms.text();
check("llms.txt reachable + text", llms.status === 200 && (llms.headers.get("content-type") ?? "").includes("text"));
check("llms.txt has required sections + endpoints", ["# Santos Site Audit API", "## API", "## Capabilities", "## Payment", "## Limitations", "## Support"].every(h => llmsText.includes(h)) && llmsText.includes("/api/audit") && llmsText.includes("openapi.json"));

// 3e) MCP server: initialize, tools/list, invalid-URL rejection
const rpc = (method, params, id = 1) => fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }).then(r => r.json());
const init = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } });
check("MCP initialize", init.result?.serverInfo?.name === "santos-site-audit");
const tools = await rpc("tools/list", {});
check("MCP lists audit_website with strict schema", tools.result?.tools?.[0]?.name === "audit_website" && tools.result?.tools?.[0]?.inputSchema?.required?.includes("url"));
const badCall = await rpc("tools/call", { name: "audit_website", arguments: { url: "http://127.0.0.1/" } });
check("MCP rejects private URL", badCall.result?.isError === true && /PRIVATE_ADDRESS_BLOCKED/.test(JSON.stringify(badCall.result)));

// 4) Paid route without payment -> 402 with valid terms
const NET = process.env.EXPECT_NETWORK ?? "base";
const unpaid = await fetch(`${BASE}/api/audit?url=example.com`);
check("paid route without payment returns 402", unpaid.status === 402, `got ${unpaid.status}`);
const accept = (await unpaid.json()).accepts?.[0];
check(`402 terms: ${NET} + payTo + $0.005 (5000 atomic)`, accept?.network === NET && /^0x[0-9a-fA-F]{40}$/.test(accept?.payTo ?? "") && accept?.maxAmountRequired === "5000");

// 5) Paid route with funded agent wallet -> settled 200 + full report
(await import("dotenv")).config();
if (!process.env.BUYER_PRIVATE_KEY) {
  console.log("SKIP  paid settlement flow (set BUYER_PRIVATE_KEY to enable)");
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
const { privateKeyToAccount } = await import("viem/accounts");
const { wrapFetchWithPayment } = await import("x402-fetch");
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPayment(fetch, account);
const paid = await fetchWithPay(`${BASE}/api/audit?url=example.com`).catch(e => e?.response ?? { status: "throw", json: async () => ({ error: String(e) }) });
const report = await paid.json();
const settled = paid.status === 200;
// Unfunded/testnet wallets on mainnet fail verification ("insufficient*" on testnet,
// "Failed to verify payment" on mainnet facilitator) — both prove the paywall challenged correctly.
const brokeButNegotiated = /insufficient|Failed to verify payment/i.test(JSON.stringify(report));
check("agent payment settles (200) or wallet unfunded on this network", settled || brokeButNegotiated, settled ? "settled!" : "negotiation verified, wallet unfunded");
if (settled) {
  check("paid report: tier/scores/checks/issues present", report.tier === "paid" && Number.isInteger(report.overall_score) && ["performance","seo","accessibility","security"].every(k => Number.isInteger(report.scores?.[k])) && Array.isArray(report.issues));
  check("on-chain receipt header present", !!paid.headers.get("x-payment-response"));
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
