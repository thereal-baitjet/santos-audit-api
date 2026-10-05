import { NextResponse } from "next/server";
import { hasDatabase } from "./store.js";

// Crawl routes stay dark until explicitly enabled AND durably backed in
// production (a memory store would lose authorized-but-unsettled payments).
export function crawlGate() {
  if (process.env.CRAWL_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Site crawling is not enabled on this deployment yet. Single-page endpoints remain available.", code: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (process.env.NODE_ENV === "production" && !hasDatabase()) {
    return NextResponse.json(
      { error: "Crawl storage is not configured (DATABASE_URL missing).", code: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
