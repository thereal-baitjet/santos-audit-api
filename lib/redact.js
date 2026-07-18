// Redact a target URL for logs and notifications: keep scheme + host (+ path
// when it carries no obvious secrets), drop query strings, fragments, and
// credentials entirely — they routinely contain tokens and signed params.
export function redactUrl(rawUrl) {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.protocol}//${u.hostname}${path}${u.search || u.hash ? "?…" : ""}`;
  } catch {
    return "(unparseable url)";
  }
}
