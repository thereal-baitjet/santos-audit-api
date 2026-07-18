// Same-origin bridge for the /agent-readiness/run page: server-side fetches the
// LIVE x402 PAYMENT-REQUIRED challenge from the canonical API and returns the
// decoded terms as clean JSON. This keeps the amount, recipient, asset, and
// network sourced from the live challenge (never hardcoded in the browser) and
// avoids cross-origin header-exposure fragility. No secrets are ever involved:
// this only reads the public 402 challenge, it never signs or pays.
import { NextResponse } from "next/server";
import { validateTarget, AuditError } from "../../../lib/safe-fetch.js";
import { PUBLIC_API_BASE_URL } from "../../../lib/base-url.js";

const NO_STORE = { "Cache-Control": "no-store" };

function decodeChallenge(headerValue) {
  try {
    const json = JSON.parse(Buffer.from(headerValue, "base64").toString("utf-8"));
    const accept = json?.accepts?.[0];
    if (!accept) return null;
    const atomic = String(accept.amount ?? accept.maxAmountRequired ?? "");
    return {
      x402_version: json.x402Version,
      scheme: accept.scheme,
      network: accept.network,
      asset: accept.asset,
      pay_to: accept.payTo,
      amount_atomic: atomic,
      amount_usdc: atomic ? (Number(atomic) / 1e6).toString() : undefined,
      asset_name: accept.extra?.name ?? "USDC",
      resource: typeof accept.resource === "string" ? accept.resource : accept.resource?.url,
      max_timeout_seconds: accept.maxTimeoutSeconds,
    };
  } catch {
    return null;
  }
}

export async function GET(req) {
  const url = req.nextUrl.searchParams.get("url") ?? "";

  // Reject invalid/blocked targets before touching the upstream challenge.
  let target;
  try {
    target = validateTarget(url).href;
  } catch (e) {
    const code = e instanceof AuditError ? e.code : "INVALID_URL";
    return NextResponse.json({ error: e.message, code }, { status: 400, headers: NO_STORE });
  }

  const endpoint = `${PUBLIC_API_BASE_URL}/api/agent-readiness?url=${encodeURIComponent(target)}&depth=quick`;

  let upstream;
  try {
    upstream = await fetch(endpoint, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  } catch {
    return NextResponse.json({ error: "Could not reach the Agent Readiness service. Try again shortly.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: NO_STORE });
  }

  // The unpaid request should be a 402 carrying the challenge. Anything else is
  // surfaced honestly (e.g. the target itself failed validation upstream).
  if (upstream.status !== 402) {
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(
      { error: body.error ?? `Unexpected upstream status ${upstream.status}`, code: body.code ?? "UNEXPECTED_RESPONSE" },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, headers: NO_STORE }
    );
  }

  const terms = decodeChallenge(upstream.headers.get("payment-required"));
  if (!terms) {
    return NextResponse.json({ error: "Payment challenge could not be decoded.", code: "CHALLENGE_DECODE_FAILED" }, { status: 502, headers: NO_STORE });
  }

  return NextResponse.json(
    { target, endpoint, terms },
    { status: 402, headers: { ...NO_STORE, "Access-Control-Allow-Origin": "*" } }
  );
}
