// Per-request SSRF + resource-limit guard for the audit browser.
// Every browser request — page, subresource, iframe, worker — passes through
// route interception here: scheme/port allowlist, private-network blocking
// (with per-hostname DNS cache), request-count and byte caps.
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const ALLOWED_PORTS = new Set((process.env.BROWSER_ALLOWED_PORTS ?? "80,443").split(",").map((p) => p.trim()));
const MAX_REQUESTS = Number(process.env.BROWSER_MAX_REQUESTS ?? 400);
const MAX_TOTAL_BYTES = Number(process.env.BROWSER_MAX_TOTAL_BYTES ?? 40 * 1024 * 1024);

// Same range logic as the control plane's lib/safe-fetch.js — duplicated here
// because the worker container ships this file standalone; keep in sync.
function isPrivateIpv4(ip) {
  const o = ip.split(".").map(Number);
  return (
    o[0] === 0 || o[0] === 10 || o[0] === 127 ||
    (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||
    (o[0] === 169 && o[1] === 254) ||
    (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
    (o[0] === 192 && o[1] === 168) ||
    (o[0] === 192 && o[1] === 0 && (o[2] === 0 || o[2] === 2)) ||
    (o[0] === 198 && (o[1] === 18 || o[1] === 19)) ||
    (o[0] === 203 && o[1] === 0 && o[2] === 113) ||
    o[0] >= 224
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
      const hi = parseInt(hexMapped[1], 16), lo = parseInt(hexMapped[2], 16);
      return isPrivateIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    if (low.startsWith("64:ff9b:")) return true;
    return (
      low === "::" || low === "::1" ||
      low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb") ||
      low.startsWith("fc") || low.startsWith("fd") || low.startsWith("ff") || low.startsWith("2001:db8")
    );
  }
  return true;
}

export class BrowserGuard {
  constructor() {
    this.hostVerdicts = new Map(); // hostname -> boolean (safe)
    this.requestCount = 0;
    this.totalBytes = 0;
    this.blocked = [];   // { url, reason }
    this.capped = false; // hit request/byte limits
  }

  async hostIsSafe(hostname) {
    const bare = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (this.hostVerdicts.has(bare)) return this.hostVerdicts.get(bare);
    let safe = true;
    if (bare === "localhost" || bare.endsWith(".localhost") || bare.endsWith(".local") || bare.endsWith(".internal")) {
      safe = false;
    } else if (isIP(bare)) {
      safe = !isPrivateIp(bare);
    } else {
      try {
        const addrs = await lookup(bare, { all: true, verbatim: true });
        safe = addrs.length > 0 && addrs.every(({ address }) => !isPrivateIp(address));
      } catch {
        safe = false; // unresolvable — let the browser surface its own error, but don't allow
      }
    }
    this.hostVerdicts.set(bare, safe);
    return safe;
  }

  // Playwright route handler. Install with context.route("**/*", (r) => guard.handleRoute(r)).
  async handleRoute(route) {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return route.abort("blockedbyclient");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      this.blocked.push({ url: url.href.slice(0, 200), reason: "scheme" });
      return route.abort("blockedbyclient");
    }
    if (url.username || url.password) {
      this.blocked.push({ url: url.hostname, reason: "credentials" });
      return route.abort("blockedbyclient");
    }
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (!ALLOWED_PORTS.has(port)) {
      this.blocked.push({ url: `${url.hostname}:${port}`, reason: "port" });
      return route.abort("blockedbyclient");
    }
    if (!(await this.hostIsSafe(url.hostname))) {
      this.blocked.push({ url: url.hostname, reason: "private-or-unresolvable-host" });
      return route.abort("blockedbyclient");
    }
    if (++this.requestCount > MAX_REQUESTS || this.totalBytes > MAX_TOTAL_BYTES) {
      this.capped = true;
      return route.abort("blockedbyclient");
    }
    return route.continue();
  }

  // Wire on context: response sizes for the byte cap.
  trackResponse(response) {
    response.body().then(
      (b) => { this.totalBytes += b?.length ?? 0; },
      () => {} // body unavailable (redirects, cached, aborted) — ignore
    );
  }
}
