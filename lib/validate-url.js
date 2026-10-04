// URL validation for purchase scripts — fail fast before spending money.
// Reuses the same validation rules as safeFetch to ensure consistency.
import { isIP } from "node:net";

const MAX_URL_LENGTH = Number(process.env.MAX_URL_LENGTH ?? 2048);

export class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function isPrivateIpv4(ip) {
  const o = ip.split(".").map(Number);
  return (
    o[0] === 0 ||                          // 0.0.0.0/8
    o[0] === 10 ||                         // 10/8
    o[0] === 127 ||                        // loopback
    (o[0] === 100 && o[1] >= 64 && o[1] <= 127) || // 100.64/10 CGNAT
    (o[0] === 169 && o[1] === 254) ||      // link-local (incl. cloud metadata)
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||  // 172.16/12
    (o[0] === 192 && o[1] === 168) ||      // 192.168/16
    (o[0] === 192 && o[1] === 0 && (o[2] === 0 || o[2] === 2)) || // 192.0.0/24, 192.0.2/24
    (o[0] === 198 && (o[1] === 18 || o[1] === 19)) || // 198.18/15 benchmarking
    (o[0] === 203 && o[1] === 0 && o[2] === 113) ||   // 203.0.113/24 documentation
    o[0] >= 224                            // multicast + reserved 224/3
  );
}

function isPrivateIp(ip) {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) {
    const low = ip.toLowerCase();
    const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    const hexMapped = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    if (low.startsWith("64:ff9b:")) return true;
    return (
      low === "::" || low === "::1" ||
      low.startsWith("fe8") || low.startsWith("fe9") ||
      low.startsWith("fea") || low.startsWith("feb") ||
      low.startsWith("fc") || low.startsWith("fd") ||
      low.startsWith("ff") ||
      low.startsWith("2001:db8")
    );
  }
  return true;
}

export function validateUrlForPurchase(rawUrl) {
  const raw = String(rawUrl ?? "").trim();

  if (!raw) {
    throw new ValidationError("MISSING_URL", "No URL provided");
  }

  if (raw.length > MAX_URL_LENGTH) {
    throw new ValidationError("URL_TOO_LONG", `URL exceeds ${MAX_URL_LENGTH} characters`);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    throw new ValidationError("UNSUPPORTED_SCHEME", `Unsupported scheme: ${raw.split(":")[0]}:`);
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new ValidationError("INVALID_URL", "Not a parseable URL — check for typos or invalid characters");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("UNSUPPORTED_SCHEME", `Unsupported scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new ValidationError("URL_CREDENTIALS_NOT_ALLOWED", "URLs with embedded credentials are not allowed");
  }

  const bare = url.hostname.replace(/^\[|\]$/g, "");
  if (bare === "localhost" || bare.endsWith(".localhost") || bare.endsWith(".local") || bare.endsWith(".internal")) {
    throw new ValidationError("PRIVATE_ADDRESS_BLOCKED", "Local or internal hostnames are not allowed");
  }

  if (isIP(bare) && isPrivateIp(bare)) {
    throw new ValidationError("PRIVATE_ADDRESS_BLOCKED", "Private or reserved IP addresses are not allowed");
  }

  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const allowedPorts = new Set((process.env.ALLOWED_TARGET_PORTS ?? "80,443").split(",").map((p) => p.trim()));
  if (!allowedPorts.has(port)) {
    throw new ValidationError("UNSUPPORTED_PORT", `Destination port ${port} is not allowed (only 80 and 443)`);
  }

  return url;
}
