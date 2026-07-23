// POST /api/leads/verify/confirm — redeem a 6-digit code for a 30-day signed
// token that unlocks the verified-email free tier (GET /api/audit/free).
import { NextResponse } from "next/server";
import { confirmCode } from "../../../../../lib/leads/verify.js";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON.", code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "A valid email address is required.", code: "INVALID_EMAIL" }, { status: 400, headers: NO_STORE });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "The 6-digit code from your email is required.", code: "INVALID_CODE" }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await confirmCode({ email, code });
    if (!result.ok) {
      const expired = result.code === "CODE_EXPIRED";
      return NextResponse.json(
        {
          error: expired ? "That code has expired. Request a new one." : "That code does not match. Check the email and try again.",
          code: result.code,
        },
        { status: expired ? 410 : 400, headers: NO_STORE }
      );
    }
    return NextResponse.json({ ok: true, token: result.token }, { headers: NO_STORE });
  } catch (e) {
    console.error("Verification confirm failed:", e.message);
    return NextResponse.json({ error: "Could not verify right now. Please try again later.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }
}
