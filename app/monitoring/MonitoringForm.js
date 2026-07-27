"use client";

import { useId, useState } from "react";
import { track } from "../../lib/analytics-client.js";

// Marketing copy only — the charged amount is enforced server-side in
// lib/monitoring/checkout.js (MONITORING_PRICE_USD) and never trusted here.
export default function MonitoringForm({ price }) {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urlId = useId();
  const emailId = useId();
  const errId = useId();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    track("payment_started");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), email: email.trim(), product: "monitoring" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.href = body.url; // hosted Stripe Checkout
        return;
      }
      setError(body.error ?? "Could not start checkout. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="ar-form buy-form"
      onSubmit={submit}
      noValidate
      toolname="startMonitoringForm"
      tooldescription="Start Santos Monitoring for a website: weekly re-audits, regression alerts when the score moves 5+ points, and a monthly digest. Starts a hosted Stripe subscription checkout. Requires explicit user confirmation — this initiates a recurring purchase."
    >
      <label htmlFor={urlId}>Website URL to monitor</label>
      <input id={urlId} name="url" type="url" inputMode="url" autoComplete="url" placeholder="https://example.com"
        value={url} onChange={(e) => setUrl(e.target.value)}
        toolparamdescription="Website URL to re-audit weekly, e.g. https://example.com"
        aria-describedby={error ? errId : undefined} required />

      <label htmlFor={emailId}>Where should we email your scores and alerts?</label>
      <input id={emailId} name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
        value={email} onChange={(e) => setEmail(e.target.value)}
        toolparamdescription="Email address to send weekly scores, regression alerts, and digests to"
        aria-describedby={error ? errId : undefined} required />

      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Starting checkout…" : `Start monitoring — $${price}/mo`}
      </button>
      {error && <p className="ar-error" id={errId} role="alert">{error}</p>}
      <p className="fine">Secure card payment via Stripe. ${price} USD per month, cancel anytime via the manage link in every email. Your first score is emailed within minutes of checkout.</p>
    </form>
  );
}
