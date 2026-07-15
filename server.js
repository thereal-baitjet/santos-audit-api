// Santos Automation Audit API
// Free tier: 1 audit/day per IP (human demo). Paid tier: $0.10/audit via x402 (agents).
import express from "express";
import { paymentMiddleware } from "x402-express";
import { auditSite } from "./audit.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4030;

// ---- CORS so the landing page can call the free demo ----
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  next();
});

// ---- service manifest (free) ----
app.get("/", (req, res) => {
  res.json({
    service: "Santos Automation — Site Audit API",
    endpoints: {
      "GET /audit/demo?url=": "free, 1/day per IP, human demo",
      "GET /audit?url=": "$0.10 USDC via x402 — unlimited, for agents",
    },
    contact: "https://santosautomation.com",
  });
});

// ---- free demo: 1 audit per IP per day ----
const demoLog = new Map(); // ip -> date string
app.get("/audit/demo", async (req, res) => {
  const today = new Date().toDateString();
  const ip = req.ip;
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

// ---- x402 paywall for the unlimited agent tier ----
app.use(
  paymentMiddleware(process.env.SELLER_ADDRESS, {
    "GET /audit": {
      price: "$0.10",
      network: process.env.X402_NETWORK ?? "base-sepolia", // flip to "base" for mainnet
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

app.listen(PORT, () => console.log(`Santos Audit API live on http://localhost:${PORT}`));
