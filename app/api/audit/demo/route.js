import { NextResponse } from "next/server";
import { auditSite } from "../../../../audit.js";

// Per-instance memory — resets on cold start, good enough for a demo.
const demoLog = new Map(); // ip -> date string

export async function GET(req) {
  const today = new Date().toDateString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (demoLog.get(ip) === today) {
    return NextResponse.json(
      { error: "Free demo is 1 audit/day. Agents can pay per-call at GET /api/audit (x402, $0.005)." },
      { status: 429, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  const url = req.nextUrl.searchParams.get("url") ?? "";
  try {
    const report = await auditSite(url);
    demoLog.set(ip, today);
    return NextResponse.json({ tier: "free-demo", ...report }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not audit: ${e.message}` },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
