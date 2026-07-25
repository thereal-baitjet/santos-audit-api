"use client";

import { useEffect, useState } from "react";

// Cookie consent banner (GDPR/ePrivacy). Stores the visitor's choice in a
// first-party, strictly-necessary cookie `santos_consent` ("all" | "essential",
// 1 year, SameSite=Lax) and mirrors it to localStorage. Analytics
// (lib/analytics-client.js) reads the same cookie and stays silent until the
// visitor accepts. Any element carrying data-cookie-settings (e.g. the footer
// link) re-opens the banner so consent can be withdrawn.
const COOKIE = "santos_consent";
const MAX_AGE = 60 * 60 * 24 * 365;

export function readConsent() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(all|essential)(?:;|$)`));
  return m ? m[1] : null;
}

function writeConsent(value) {
  document.cookie = `${COOKIE}=${value}; max-age=${MAX_AGE}; path=/; samesite=lax`;
  try { localStorage.setItem(COOKIE, value); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent("santos:consent", { detail: { consent: value } }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
    const open = (e) => {
      e.preventDefault();
      setVisible(true);
    };
    // Delegated binding so server-rendered markup (footer link) works too.
    document.addEventListener("click", (e) => {
      if (e.target?.closest?.("[data-cookie-settings]")) open(e);
    });
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    writeConsent(value);
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p>
        We use one essential cookie to remember this choice, and privacy-safe,
        first-party analytics (no third-party trackers, no personal data) only if
        you accept. Details in our{" "}
        <a href="/terms#cookies">privacy &amp; cookie notice</a>.
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn primary small" onClick={() => choose("all")}>
          Accept analytics
        </button>
        <button type="button" className="btn small" onClick={() => choose("essential")}>
          Essential only
        </button>
      </div>
    </div>
  );
}
