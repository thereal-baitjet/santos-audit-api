// Shared free-tier limiter: 1 audit per IP per day, across the demo route and
// the MCP tool. Per-instance memory — resets on cold start, good enough for a demo.
const demoLog = new Map(); // ip -> date string

export function hasFreeAudit(ip) {
  return demoLog.get(ip) !== new Date().toDateString();
}

// Only called after a successful audit, so a failed attempt doesn't burn the day's credit.
export function markFreeAudit(ip) {
  demoLog.set(ip, new Date().toDateString());
}

export function ipFromRequest(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
