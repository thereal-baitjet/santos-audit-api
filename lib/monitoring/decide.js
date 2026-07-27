// Pure decision logic for the weekly monitoring re-audit (app/api/cron/daily).
// Kept DB-free so the alert/digest policy is unit-testable (tests/monitoring.test.js).

// Alert when the score moves this many points in either direction.
export const ALERT_THRESHOLD = 5;
// Send the "all stable" digest at most this often.
export const DIGEST_INTERVAL_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

// What to email after a monitoring run, given the previous state:
//   "alert"  — score moved >= ALERT_THRESHOLD points since last_score
//   "digest" — score stable AND no digest in the last DIGEST_INTERVAL_DAYS
//   "none"   — score stable and a digest went out recently (or no baseline yet)
// `now` and `lastDigestAt` accept Date objects, ISO strings, or epoch ms.
export function decideMonitoringAction({ lastScore, newScore, lastDigestAt, now }) {
  if (!Number.isFinite(newScore)) return "none";
  if (Number.isFinite(lastScore) && Math.abs(newScore - lastScore) >= ALERT_THRESHOLD) return "alert";
  const nowMs = new Date(now ?? Date.now()).getTime();
  const digestMs = lastDigestAt ? new Date(lastDigestAt).getTime() : null;
  if (digestMs == null || !Number.isFinite(digestMs) || nowMs - digestMs >= DIGEST_INTERVAL_DAYS * DAY_MS) {
    return "digest";
  }
  return "none";
}

// Up to 5 human-readable issue lines from a stored audit report, for the
// regression alert email. Prefers the prioritized fixes
// (recommended_actions[].title, the remediation text) and falls back to a
// plain `issues` string array (the shape the free-audit email uses).
export function topIssuesFromReport(report, limit = 5) {
  if (!report || typeof report !== "object") return [];
  if (Array.isArray(report.recommended_actions)) {
    const titles = report.recommended_actions
      .map((action) => action?.title)
      .filter((title) => typeof title === "string" && title.trim());
    if (titles.length) return titles.slice(0, limit);
  }
  if (Array.isArray(report.issues)) {
    return report.issues.filter((issue) => typeof issue === "string" && issue.trim()).slice(0, limit);
  }
  return [];
}
