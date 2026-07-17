"use client";

import { useState } from "react";

const grade = (s) => (s >= 80 ? "good" : s >= 55 ? "warn" : "bad");

export default function AuditWidget() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState({ status: "idle" }); // idle | loading | error | done

  async function onSubmit(e) {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;
    setState({ status: "loading", url: target });
    try {
      const res = await fetch(`/api/audit/demo?url=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Audit failed" });
        return;
      }
      setState({ status: "done", data });
    } catch {
      setState({ status: "error", message: "Could not reach the audit API. Try again in a moment." });
    }
  }

  return (
    <>
      <form className="audit-form" onSubmit={onSubmit}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourdomain.com"
          aria-label="Website URL to audit"
          required
        />
        <button className="btn primary" type="submit">Audit</button>
      </form>
      <p className="audit-note">
        Agents: skip the limit — <code>GET /api/audit?url=…</code> · $0.005 USDC via x402 · no API key
      </p>

      {state.status !== "idle" && (
        <div id="result" aria-live="polite">
          {state.status === "loading" && <p className="spinner">auditing {state.url} …</p>}
          {state.status === "error" && <p className="error">{state.message}</p>}
          {state.status === "done" && (
            <>
              <div className="score-row">
                <div className="score-card">
                  <div className={`num ${grade(state.data.overall_score)}`}>{state.data.overall_score}</div>
                  <div className="lbl">Overall</div>
                </div>
                {Object.entries(state.data.scores).map(([k, v]) => (
                  <div className="score-card" key={k}>
                    <div className={`num ${grade(v)}`}>{v}</div>
                    <div className="lbl">{k}</div>
                  </div>
                ))}
              </div>
              {state.data.issues.length ? (
                <ul className="issues">
                  {state.data.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="clean">No issues found — clean site.</p>
              )}
              <p className="fix-cta">
                Want these fixed? <a href="#contact">Let&rsquo;s talk</a> — or grab the full report via the paid API.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
