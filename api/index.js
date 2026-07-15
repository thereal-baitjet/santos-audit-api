// Santos Automation Audit API — Vercel serverless entry.
// Same app as server.js, exported instead of listened.
import express from "express";
import { paymentMiddleware } from "x402-express";
import { auditSite } from "../audit.js";

const app = express();

// Receiving wallet (public address, not a secret) + network via env with safe defaults
const SELLER = process.env.SELLER_ADDRESS ?? "0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B";
const NETWORK = process.env.X402_NETWORK ?? "base";

app.use((req, res, next) => { res.set("Access-Control-Allow-Origin", "*"); next(); });

app.get("/", (req, res) => {
  res.json({
    service: "Santos Automation — Site Audit API",
    network: NETWORK,
    endpoints: {
      "GET /audit/demo?url=": "free, 1/day per IP, human demo",
      "GET /audit?url=": "$0.10 USDC via x402 — unlimited, for agents",
    },
    contact: "https://santosautomation.com",
  });
});

// Free demo: 1/day per IP (per-instance memory — resets on cold start, good enough for a demo)
const demoLog = new Map();
app.get("/audit/demo", async (req, res) => {
  const today = new Date().toDateString();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] ?? req.ip;
  if (demoLog.get(ip) === today) {
    return res.status(429).json({
      error: "Free demo is 1 audit/day. Agents can pay per-call at GET /audit (x402, $0.10).",
    });
  }
  try {
    const report = await auditSite(String(req.query.url ?? ""));
    demoLog.set(ip, today);
    res.json({ tier: "free-demo", ...report });
  } catch (e) {
    res.status(400).json({ error: `Could not audit: ${e.message}` });
  }
});

app.use(
  paymentMiddleware(SELLER, {
    "GET /audit": {
      price: "$0.10",
      network: NETWORK,
      config: { description: "Full site audit: performance, SEO, accessibility, security" },
    },
  })
);

app.get("/audit", async (req, res) => {
  try {
    res.json({ tier: "paid", ...(await auditSite(String(req.query.url ?? ""))) });
  } catch (e) {
    res.status(400).json({ error: `Could not audit: ${e.message}` });
  }
});

export default app;
