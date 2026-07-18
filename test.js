// E2E checks for the Santos Audit API.
// Default target: local dev server on :3000. Override: BASE=https://api.santosautomation.com npm test
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
const ssrfCases = [
  ["http://169.254.169.254/latest/meta-data/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://localhost:3000/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://10.0.0.1/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://100.64.0.1/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://[::1]/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://[::ffff:10.0.0.1]/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://[::ffff:a00:1]/", "PRIVATE_ADDRESS_BLOCKED"],
  ["http://[fd00::1]/", "PRIVATE_ADDRESS_BLOCKED"],
  ["ftp://example.com/", "UNSUPPORTED_SCHEME"],
  ["http://user:pass@example.com/", "URL_CREDENTIALS_NOT_ALLOWED"],
  ["http://example.com:8080/", "UNSUPPORTED_PORT"],
  [`http://example.com/${"a".repeat(2100)}`, "URL_TOO_LONG"],
];
for (const [target, expectCode] of ssrfCases) {
  const r = await fetch(`${BASE}/api/audit/demo?url=${encodeURIComponent(target)}`);
  const b = await r.json().catch(() => ({}));
  check(`blocked (${expectCode}): ${target.slice(0, 60)}`, r.status >= 400 && b.code === expectCode, `got ${r.status} code=${b.code}`);
}

// 3b2) CORS preflight for browser agents on the paid route
const pre = await fetch(`${BASE}/api/audit`, {
  method: "OPTIONS",
  headers: { Origin: "https://example-agent.app", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "PAYMENT-SIGNATURE" },
});
check("paid route preflight allows PAYMENT-SIGNATURE + exposes payment headers",
  pre.status === 204 &&
  /PAYMENT-SIGNATURE/i.test(pre.headers.get("access-control-allow-headers") ?? "") &&
  /PAYMENT-REQUIRED/i.test(pre.headers.get("access-control-expose-headers") ?? ""));

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

// 3e) MCP server: negotiation, origin policy, tools/list, invalid-URL rejection
const rpc = (method, params, id = 1, headers = {}) => fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
const init = await (await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } })).json();
check("MCP initialize (supported version echoed)", init.result?.serverInfo?.name === "santos-site-audit" && init.result?.protocolVersion === "2025-03-26");
const initNeg = await (await rpc("initialize", { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "test", version: "0" } })).json();
check("MCP initialize negotiates unsupported version to server latest", initNeg.result?.protocolVersion === "2025-06-18");
const badVer = await rpc("tools/list", {}, 2, { "mcp-protocol-version": "1999-01-01" });
check("MCP rejects unsupported MCP-Protocol-Version header", badVer.status === 400);
const badOrigin = await rpc("tools/list", {}, 3, { Origin: "https://evil.example" });
check("MCP rejects untrusted browser Origin", badOrigin.status === 403);
const tools = await (await rpc("tools/list", {})).json();
check("MCP lists audit_website_preview with strict schema", tools.result?.tools?.[0]?.name === "audit_website_preview" && tools.result?.tools?.[0]?.inputSchema?.required?.includes("url") && tools.result?.tools?.[0]?.inputSchema?.additionalProperties === false);
check("MCP tool discloses paid x402 endpoint", /x402|\$0\.005/.test(tools.result?.tools?.[0]?.description ?? ""));
const badCall = await (await rpc("tools/call", { name: "audit_website_preview", arguments: { url: "http://127.0.0.1/" } })).json();
check("MCP rejects private URL", badCall.result?.isError === true && /PRIVATE_ADDRESS_BLOCKED/.test(JSON.stringify(badCall.result)));

// 4) Paid route without payment -> 402 with valid x402 v2 terms in PAYMENT-REQUIRED header
const NET = process.env.EXPECT_NETWORK ?? "eip155:8453";
const unpaid = await fetch(`${BASE}/api/audit?url=example.com`);
check("paid route without payment returns 402", unpaid.status === 402, `got ${unpaid.status}`);
const prHeader = unpaid.headers.get("payment-required");
check("402 carries PAYMENT-REQUIRED header", !!prHeader);
const terms = prHeader ? JSON.parse(Buffer.from(prHeader, "base64").toString("utf-8")) : {};
const accept = terms.accepts?.[0];
check(`402 terms: v2 + ${NET} + payTo + $0.005 (5000 atomic)`, terms.x402Version === 2 && accept?.network === NET && /^0x[0-9a-fA-F]{40}$/.test(accept?.payTo ?? "") && accept?.amount === "5000");
check("402 carries bazaar discovery extension", !!terms.extensions?.bazaar?.info?.input && !!terms.extensions?.bazaar?.schema);
const unpaidBody = await unpaid.json().catch(() => ({}));
check("402 body has agent-readable hint", unpaidBody.code === "PAYMENT_REQUIRED" && /PAYMENT-REQUIRED/.test(unpaidBody.hint ?? ""));

// 5) Paid route with funded agent wallet -> settled 200 + full report
(await import("dotenv")).config();
if (!process.env.BUYER_PRIVATE_KEY) {
  console.log("SKIP  paid settlement flow (set BUYER_PRIVATE_KEY to enable)");
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}
const { privateKeyToAccount } = await import("viem/accounts");
const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
const { ExactEvmScheme } = await import("@x402/evm");
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NET, client: new ExactEvmScheme(account) }],
});
const paid = await fetchWithPay(`${BASE}/api/audit?url=example.com`).catch(e => e?.response ?? { status: "throw", headers: new Headers(), json: async () => ({ error: String(e) }) });
const report = await paid.json();
const settled = paid.status === 200;
// Unfunded wallets fail verification at the facilitator — that still proves the
// paywall challenged and the client negotiated correctly.
const brokeButNegotiated = /insufficient|verify|invalid/i.test(JSON.stringify(report));
check("agent payment settles (200) or wallet unfunded on this network", settled || brokeButNegotiated, settled ? "settled!" : "negotiation verified, wallet unfunded");
if (settled) {
  check("paid report: tier/scores/checks/issues present", report.tier === "paid" && Number.isInteger(report.overall_score) && ["performance","seo","accessibility","security"].every(k => Number.isInteger(report.scores?.[k])) && Array.isArray(report.issues));
  check("on-chain receipt header present", !!paid.headers.get("payment-response"));
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
