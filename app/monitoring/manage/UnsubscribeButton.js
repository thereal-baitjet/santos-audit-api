"use client";

import { useState } from "react";

// Posts the manage token to the unsubscribe API; on success the button is
// replaced by an inline confirmation (the token stays in the URL, so a reload
// shows the server-rendered canceled state).
export default function UnsubscribeButton({ token }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function unsubscribe() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/monitoring/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        return;
      }
      setError(body.error ?? "Could not cancel right now. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status"><strong>Your subscription is canceled.</strong> No further
        charges will be made, and weekly re-audits have stopped.</p>
    );
  }

  return (
    <>
      <button className="btn" type="button" onClick={unsubscribe} disabled={busy}>
        {busy ? "Canceling…" : "Unsubscribe"}
      </button>
      {error && <p className="ar-error" role="alert">{error}</p>}
    </>
  );
}
