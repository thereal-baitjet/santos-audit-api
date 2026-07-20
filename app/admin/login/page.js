"use client";

import { useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";

const CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
      // Full navigation (not router.push) so proxy.js sees the fresh session
      // cookies and lets the dashboard through.
      window.location.assign("/admin/dashboard");
    } catch {
      setError("Could not reach the authentication service.");
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <main className="admin-login-card">
        <a className="brand admin-brand" href="/">
          <img src="/assets/santos-eagle.svg" alt="Santos Intelligence eagle emblem" width="1254" height="1254" />
          <span>Santos Intelligence</span>
        </a>
        <p className="kicker">Traffic Control · restricted access</p>
        <h1>Admin sign in</h1>
        <p className="admin-login-sub">Operator access to the live agent-traffic console.</p>

        {!CONFIGURED ? (
          <p className="admin-error" role="alert">
            Supabase is not configured on this deployment — set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="admin-form">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@santosautomation.com"
            />
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            {error && <p className="admin-error" role="alert">{error}</p>}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Authenticating…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="admin-fine">Authorized operators only. Sessions are cookie-scoped and verified on every request.</p>
      </main>
    </div>
  );
}
