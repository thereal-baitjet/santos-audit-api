// HMAC-signed manage/unsubscribe tokens for Santos Monitoring subscriptions.
// Same pattern as lib/leads/verify.js: base64url payload + trailing HMAC
// segment, nothing stored server-side. Tokens are long-lived (manage links in
// email footers) so no expiry segment is checked today — the signed payload
// is `${version}.${subscriptionId}.${expSeconds}` where expSeconds is 0
// ("never expires"); minting with a real expiry and checking it here is the
// future upgrade path without changing the token format.
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSecret } from "../required-env.js";

const TOKEN_SECRET = requireSecret("REPORT_ACCESS_TOKEN_SECRET", "dev-only-report-token-secret");
const VERSION = "1";

const b64 = (value) => Buffer.from(String(value)).toString("base64url");
const unb64 = (value) => Buffer.from(String(value), "base64url").toString("utf8");

// Sign a manage token for a subscription. expSeconds defaults to 0 (no
// expiry); pass a unix-seconds timestamp to mint an expiring token.
export function monitoringTokenFor(subscriptionId, expSeconds = 0) {
  const id = String(subscriptionId ?? "");
  if (!id) return null;
  const mac = createHmac("sha256", TOKEN_SECRET).update(`monitoring.${VERSION}.${id}.${expSeconds}`).digest("base64url");
  return `${b64(VERSION)}.${b64(id)}.${b64(expSeconds)}.${mac}`;
}

// Validate a manage token. Returns the subscription id, or null when the
// shape, signature, or expiry check fails.
export function verifyMonitoringToken(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 4) return null;
  let version, id, expSeconds;
  try {
    version = unb64(parts[0]);
    id = unb64(parts[1]);
    expSeconds = Number(unb64(parts[2]));
  } catch {
    return null;
  }
  if (version !== VERSION || !id || !Number.isFinite(expSeconds)) return null;

  const expected = Buffer.from(
    createHmac("sha256", TOKEN_SECRET).update(`monitoring.${version}.${id}.${expSeconds}`).digest("base64url"),
    "utf8"
  );
  const given = Buffer.from(parts[3], "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (expSeconds > 0 && expSeconds * 1000 <= Date.now()) return null;
  return id;
}
