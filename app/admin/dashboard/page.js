"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "../../../lib/supabase-browser.js";

const MAX_ROWS = 200;

function timeOf(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return "—";
  }
}

function statusClass(status) {
  if (status == null) return "";
  if (status >= 500) return "bad";
  if (status >= 400) return "warn";
  return "good";
}

export default function AdminDashboard() {
  const supabaseRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [feed, setFeed] = useState("connecting"); // connecting | live | error
  const [loadError, setLoadError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabaseRef.current = supabase;
    let cancelled = false;

    async function boot() {
      // proxy.js already gates this route; this is belt-and-suspenders for a
      // session that expires while the tab is open.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/admin/login");
        return;
      }
      if (cancelled) return;
      setUserEmail(user.email);

      const { data, error } = await supabase
        .from("agent_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) setLoadError(error.message);
      else setLogs(data ?? []);
    }

    boot();

    const channel = supabase
      .channel("agent-logs-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_logs" },
        (payload) => {
          setLogs((prev) => [{ ...payload.new, _fresh: true }, ...prev].slice(0, MAX_ROWS));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setFeed("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setFeed("error");
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleSignOut() {
    await supabaseRef.current?.auth.signOut();
    window.location.assign("/admin/login");
  }

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState(null); // { ok: boolean, text: string }
  const [pwBusy, setPwBusy] = useState(false);

  async function handleChangePassword(event) {
    event.preventDefault();
    setPwMsg(null);
    if (pw.length < 10) {
      setPwMsg({ ok: false, text: "Use at least 10 characters." });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: "Passwords do not match." });
      return;
    }
    setPwBusy(true);
    const { error } = await supabaseRef.current.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) setPwMsg({ ok: false, text: error.message });
    else {
      setPw("");
      setPw2("");
      setPwMsg({ ok: true, text: "Password updated. Use it on your next sign-in." });
    }
  }

  return (
    <div className="wrap admin-dash">
      <header className="admin-dash-head">
        <div>
          <a className="brand admin-brand" href="/">
            <img src="/assets/santos-eagle.svg" alt="Santos Intelligence eagle emblem" width="1254" height="1254" />
            <span>Santos Intelligence</span>
          </a>
          <h1>Santos Traffic Control</h1>
          <p className="admin-dash-sub">
            Live <code>agent_logs</code> feed · newest first · initial window 50 events
          </p>
        </div>
        <div className="admin-dash-controls">
          <span className={`live-badge live-badge--${feed}`}>
            <span className="live-dot" aria-hidden="true" />
            {feed === "live" ? "LIVE" : feed === "connecting" ? "CONNECTING" : "FEED ERROR"}
          </span>
          {userEmail && <span className="admin-user">{userEmail}</span>}
          <button className="btn admin-signout" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {loadError && (
        <p className="admin-error" role="alert">
          Could not load agent_logs: {loadError}
        </p>
      )}

      <details className="admin-pass">
        <summary>Change password</summary>
        <form onSubmit={handleChangePassword} className="admin-pass-form">
          <label htmlFor="new-pass">New password</label>
          <input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <label htmlFor="new-pass-2">Repeat new password</label>
          <input
            id="new-pass-2"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <button className="btn" type="submit" disabled={pwBusy}>
            {pwBusy ? "Updating…" : "Update password"}
          </button>
          {pwMsg && (
            <p className={pwMsg.ok ? "admin-pass-ok" : "admin-error"} role="alert">{pwMsg.text}</p>
          )}
        </form>
      </details>

      <div className="table-wrap admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Agent</th>
              <th scope="col">Method</th>
              <th scope="col">Path</th>
              <th scope="col">Status</th>
              <th scope="col">Country</th>
              <th scope="col">User agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loadError ? (
              <tr>
                <td colSpan={7} className="admin-empty">
                  No agent traffic logged yet — new visits will appear here instantly.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className={row._fresh ? "admin-row-fresh" : undefined}>
                  <td className="mono">{timeOf(row.created_at)}</td>
                  <td className="admin-agent">{row.agent_name ?? "unknown"}</td>
                  <td className="mono">{row.method}</td>
                  <td className="mono admin-path">{row.path}</td>
                  <td className={`mono num ${statusClass(row.status)}`}>{row.status ?? "—"}</td>
                  <td>{row.country ?? "—"}</td>
                  <td className="admin-ua" title={row.user_agent ?? ""}>{row.user_agent ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-fine">
        Reads are RLS-scoped to allowlisted admin emails. Events stream over Supabase realtime
        (postgres_changes on INSERT); the view keeps the most recent {MAX_ROWS} rows in memory.
      </p>
    </div>
  );
}
