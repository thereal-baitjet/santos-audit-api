import { NextResponse } from "next/server";
import { capabilityManifest } from "../../lib/capabilities.js";

export async function GET() {
  return NextResponse.json(capabilityManifest(), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
