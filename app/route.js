import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      service: "Santos Automation — Site Audit API",
      network: "base",
      endpoints: {
        "GET /api/audit/demo?url=": "free, 1/day per IP, human demo",
        "GET /api/audit?url=": "$0.005 USDC via x402 — unlimited, for agents",
      },
      contact: "https://santosautomation.com",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
