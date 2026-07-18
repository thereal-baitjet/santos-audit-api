"use client";

import { useId, useState } from "react";
import { track } from "../../../lib/analytics-client.js";

export default function BuyForm() {
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
        body: JSON.stringify({ url: url.trim(), email: email.trim() }),
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
    <form className="ar-form buy-form" onSubmit={submit} noValidate>
      <label htmlFor={urlId}>Website URL to audit</label>
      <input id={urlId} type="url" inputMode="url" autoComplete="url" placeholder="https://example.com"
        value={url} onChange={(e) => setUrl(e.target.value)}
        aria-describedby={error ? errId : undefined} required />

      <label htmlFor={emailId}>Where should we email your report?</label>
      <input id={emailId} type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
        value={email} onChange={(e) => setEmail(e.target.value)}
        aria-describedby={error ? errId : undefined} required />

      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Starting checkout…" : "Buy report — $19"}
      </button>
      {error && <p className="ar-error" id={errId} role="alert">{error}</p>}
      <p className="fine">Secure card payment via Stripe. No account needed. One-time $19 USD — you'll get an emailed link to your report, usually within a few minutes.</p>
    </form>
  );
}
