"use client";

// Privacy-conscious, first-party, CSP-compatible funnel analytics.
// Sends only an event name (+ optional coarse, non-sensitive props) to a
// same-origin beacon. Never captures URLs, query strings, report contents,
// wallet data, or payment signatures. Fails silently if unavailable.
const ALLOWED = new Set([
  "homepage_viewed", "free_audit_started", "free_audit_completed", "free_audit_failed",
  "pricing_viewed", "sample_report_viewed", "paid_agent_flow_viewed",
  "payment_challenge_received", "payment_started", "payment_completed",
  "payment_rejected", "agent_audit_completed", "openapi_downloaded", "contact_clicked",
]);

export function track(event, props) {
  try {
    if (typeof window === "undefined" || !ALLOWED.has(event)) return;
    // Only whitelisted scalar props; drop anything URL-ish or long.
    const safe = {};
    if (props && typeof props === "object") {
      for (const [k, v] of Object.entries(props)) {
        if (typeof v === "number" || typeof v === "boolean") safe[k] = v;
      }
    }
    const body = JSON.stringify({ e: event, p: safe, t: Date.now() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch { /* analytics must never break the page */ }
}

// Wire up any element carrying data-analytics-event so existing markup emits
// events without per-component code. Call once from a client boundary.
export function bindAnalyticsAttributes() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (e) => {
    const el = e.target?.closest?.("[data-analytics-event]");
    if (el) track(el.getAttribute("data-analytics-event"));
  }, { passive: true });
}
