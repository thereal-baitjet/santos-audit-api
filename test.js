// E2E checks for the Santos Audit API.
// Default target: local dev server on :4030. Override: BASE=https://api.santosautomation.com npm test
const BASE = process.env.BASE ?? "http://localhost:4030";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

// 1) Manifest
const root = await fetch(`${BASE}/`);
const manifest = await root.json();
check("manifest returns 200", root.status === 200);
check("manifest lists demo + paid endpoints", !!manifest.endpoints?.["GET /audit/demo?url="] && !!manifest.endpoints?.["GET /audit?url="]);

// 2) Free demo: 200 with a report, or 429 if this IP already used today's audit
const demo = await fetch(`${BASE}/audit/demo?url=example.com`);
const demoBody = await demo.json();
if (demo.status === 200) {
  check("free demo returns scored report", demoBody.tier === "free-demo" && Number.isInteger(demoBody.overall_score));
  const again = await fetch(`${BASE}/audit/demo?url=example.com`);
  check("second demo same day rate-limited 429", again.status === 429, `got ${again.status}`);
} else {
  check("free demo rate-limits with 429 + upsell", demo.status === 429 && /x402/.test(demoBody.error ?? ""), `got ${demo.status}`);
}

// 3) Demo input validation
const bad = await fetch(`${BASE}/audit/demo?url=${encodeURIComponent("not a real host..")}`);
check("invalid URL handled gracefully (4xx, JSON error)", bad.status >= 400 && bad.status < 500);

// 4) Paid route without payment -> 402 with valid terms
const unpaid = await fetch(`${BASE}/audit?url=example.com`);
check("paid route without payment returns 402", unpaid.status === 402, `got ${unpaid.status}`);
const accept = (await unpaid.json()).accepts?.[0];
check("402 terms: network + payTo + $0.10 (100000 atomic)", accept?.network === "base-sepolia" && /^0x[0-9a-fA-F]{40}$/.test(accept?.payTo ?? "") && accept?.maxAmountRequired === "100000");

// 5) Paid route with funded agent wallet -> settled 200 + full report
const { privateKeyToAccount } = await import("viem/accounts");
const { wrapFetchWithPayment } = await import("x402-fetch");
(await import("dotenv")).config();
const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPayment(fetch, account);
const paid = await fetchWithPay(`${BASE}/audit?url=example.com`);
const report = await paid.json();
check("agent payment settles with 200", paid.status === 200, `got ${paid.status}`);
check("paid report: tier/scores/checks/issues present", report.tier === "paid" && Number.isInteger(report.overall_score) && ["performance","seo","accessibility","security"].every(k => Number.isInteger(report.scores?.[k])) && Array.isArray(report.issues));
check("on-chain receipt header present", !!paid.headers.get("x-payment-response"));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
