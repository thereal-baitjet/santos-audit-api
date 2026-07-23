// HMAC-SHA256 report signing. signReport stamps an audit report with a
// signature over its canonical JSON (recursively sorted keys, signature
// fields excluded) so anyone holding the key can prove a report came from
// this service and was not modified. Pure functions, no I/O.
//
// Key: REPORT_ACCESS_TOKEN_SECRET (already used for paid report access), with
// a dev-only fallback so local runs work without env.
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_FIELDS = ["signature", "signature_alg", "signed_at"];

function secret() {
  return process.env.REPORT_ACCESS_TOKEN_SECRET ?? "dev-only-report-token-secret";
}

// Recursively sort object keys so semantically equal reports serialize
// identically regardless of key insertion order.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function withoutSignatureFields(report) {
  return Object.fromEntries(
    Object.entries(report ?? {}).filter(([key]) => !SIGNATURE_FIELDS.includes(key))
  );
}

function signatureFor(report) {
  const canonical = JSON.stringify(canonicalize(withoutSignatureFields(report)));
  return createHmac("sha256", secret()).update(canonical).digest("hex");
}

// Returns a new object: the report plus signature metadata. The signature
// covers the report WITHOUT the signature fields (so signed_at is a stamp,
// not part of the signed payload).
export function signReport(report) {
  const base = withoutSignatureFields(report);
  return {
    ...base,
    signature_alg: "HMAC-SHA256",
    signed_at: new Date().toISOString(),
    signature: signatureFor(base),
  };
}

// Recomputes the signature over the report's non-signature fields and
// compares in constant time.
export function verifyReportSignature(report) {
  if (!report || typeof report !== "object" || typeof report.signature !== "string") {
    return { valid: false };
  }
  const expected = Buffer.from(signatureFor(report), "utf8");
  const given = Buffer.from(report.signature, "utf8");
  return { valid: given.length === expected.length && timingSafeEqual(given, expected) };
}
