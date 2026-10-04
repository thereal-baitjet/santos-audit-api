"use client";

import { useId, useState } from "react";
import { track } from "../../../lib/analytics-client.js";

// Presentation receives canonical prices from the server. The checkout route
// continues to enforce the price and validate the tier independently.
export default function BuyForm({ initialTier = "quick", tiers }) {
  const [tier, setTier] = useState(initialTier === "deep" ? "deep" : "quick");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urlId = useId();
  const emailId = useId();
  const errId = useId();
  const selected = tiers.find((t) => t.key === tier) ?? tiers[0];

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    track("payment_started");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), email: email.trim(), tier }),
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
      toolname="buyAgentReadinessReportForm"
      tooldescription="Buy a human-readable website report: Quick (fetch-based) or Deep (browser-rendered). See the displayed price for each tier. Starts hosted Stripe checkout; the report is emailed after payment. Requires explicit user confirmation — this initiates a purchase."
    >
      <div
        className="track-grid"
        role="group"
        aria-label="Choose a report tier"
      >
        {tiers.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`track${tier === t.key ? " track--selected" : ""}`}
            aria-pressed={tier === t.key}
            onClick={() => setTier(t.key)}
            toolparamdescription={`Select the ${t.name} report tier (${t.price})`}
          >
            <h3>{t.name}</h3>
            <p className="track-price">
              {t.price} <span>one-time report</span>
            </p>
            <p>{t.blurb}</p>
          </button>
        ))}
      </div>

      <label htmlFor={urlId}>Website URL to audit</label>
      <input
        id={urlId}
        name="url"
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        toolparamdescription="Website URL to audit, e.g. https://example.com"
        aria-describedby={error ? errId : undefined}
        required
      />

      <label htmlFor={emailId}>Where should we email your report?</label>
      <input
        id={emailId}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        toolparamdescription="Email address to send the finished report to"
        aria-describedby={error ? errId : undefined}
        required
      />

      <button className="btn primary" type="submit" disabled={busy}>
        {busy
          ? "Starting checkout…"
          : `Buy ${selected.name.toLowerCase()} report — ${selected.price}`}
      </button>
      {error && (
        <p className="ar-error" id={errId} role="alert">
          {error}
        </p>
      )}
      <p className="fine">
        Secure card payment via Stripe. No account needed. One-time{" "}
        {selected.price} USD — you'll get an emailed link to your report
        {tier === "deep" ? " when the browser-rendered audit finishes" : ""},
        usually within a few minutes.
      </p>
    </form>
  );
}
