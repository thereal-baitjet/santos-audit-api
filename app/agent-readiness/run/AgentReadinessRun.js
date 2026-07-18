"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { track } from "../../../lib/analytics-client.js";

// State machine per the product spec. Browser-wallet payment is feature-detected;
// when no compatible x402 wallet is present we stay on "payment-required" and
// surface copyable client instructions (the safe default).
const STATES = {
  IDLE: "idle",
  VALIDATING: "validating",
  PAYMENT_REQUIRED: "payment-required",
  AWAITING_SIGNATURE: "awaiting-signature",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REJECTED: "rejected",
  RATE_LIMITED: "rate-limited",
  INVALID_TARGET: "invalid-target",
  UNAVAILABLE: "unavailable",
};

const STATUS_TEXT = {
  [STATES.IDLE]: "",
  [STATES.VALIDATING]: "Validating the target and fetching live payment terms…",
  [STATES.PAYMENT_REQUIRED]: "Payment required. Review the terms below before signing.",
  [STATES.AWAITING_SIGNATURE]: "Waiting for your wallet to sign the payment authorization…",
  [STATES.PROCESSING]: "Payment signed. Running the Agent Readiness audit…",
  [STATES.COMPLETED]: "Audit complete.",
  [STATES.REJECTED]: "The payment was rejected or could not be verified.",
  [STATES.RATE_LIMITED]: "Rate limited. Please wait before trying again.",
  [STATES.INVALID_TARGET]: "That target can't be audited.",
  [STATES.UNAVAILABLE]: "The service is temporarily unavailable.",
};

function snippets(endpoint) {
  const js = `import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay("${endpoint}");
console.log(await res.json());`;
  const curl = `# 1) Unpaid request returns 402 with a base64 PAYMENT-REQUIRED header:
curl -si "${endpoint}" | grep -i '^payment-required'

# 2) Decode it, sign an EIP-3009 transferWithAuthorization for the quoted USDC
#    amount, then retry with a PAYMENT-SIGNATURE header. Any x402 v2 client
#    (e.g. @x402/fetch above) automates steps 1-2.`;
  return { js, curl };
}

export default function AgentReadinessRun() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState(STATES.IDLE);
  const [terms, setTerms] = useState(null);
  const [endpoint, setEndpoint] = useState("");
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(null);
  const [copied, setCopied] = useState("");
  const [walletAvailable, setWalletAvailable] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const abortRef = useRef(null);

  useEffect(() => {
    track("paid_agent_flow_viewed");
    // Feature-detect a browser wallet. A real x402 EIP-3009 in-browser signer is
    // not bundled, so we only advertise "Pay in browser" when future wallet
    // support is wired; today this stays false and we show copyable instructions.
    setWalletAvailable(false);
  }, []);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    const target = url.trim();
    if (!target) return;
    setError("");
    setTerms(null);
    setRetryAfter(null);
    setState(STATES.VALIDATING);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let res;
    try {
      res = await fetch(`/agent-readiness/challenge?url=${encodeURIComponent(target)}`, { signal: ctrl.signal });
    } catch {
      setState(STATES.UNAVAILABLE);
      setError("Could not reach the service. Check your connection and try again.");
      return;
    }
    const body = await res.json().catch(() => ({}));

    if (res.status === 402 && body.terms) {
      setTerms(body.terms);
      setEndpoint(body.endpoint);
      setState(STATES.PAYMENT_REQUIRED);
      track("payment_challenge_received");
      return;
    }
    if (res.status === 429) {
      setRetryAfter(res.headers.get("retry-after"));
      setState(STATES.RATE_LIMITED);
      setError(body.error ?? "Too many requests.");
      return;
    }
    if (res.status === 503) {
      setState(STATES.UNAVAILABLE);
      setError(body.error ?? "Service temporarily unavailable.");
      return;
    }
    // 400/4xx target problems
    setState(STATES.INVALID_TARGET);
    setError(body.error ?? "That target can't be audited.");
  }, [url]);

  const copy = useCallback(async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard unavailable — the code is still visible to select */ }
  }, []);

  const isBusy = state === STATES.VALIDATING || state === STATES.PROCESSING || state === STATES.AWAITING_SIGNATURE;
  const code = endpoint ? snippets(endpoint) : null;

  return (
    <div className="ar-run">
      <form
        className="ar-form"
        onSubmit={submit}
        noValidate
        toolname="agentReadinessTermsForm"
        tooldescription="Get the live x402 payment terms for a paid Agent Readiness audit of a public URL. Read-only: shows USDC amount, network, and pay-to address; no payment happens until an x402 client pays the terms."
        toolautosubmit=""
      >
        <label htmlFor={inputId}>Public website or service URL to audit</label>
        <div className="ar-input-row">
          <input
            id={inputId}
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={state === STATES.INVALID_TARGET || undefined}
            toolparamdescription="Public website or service URL to audit, e.g. https://example.com"
            required
          />
          <button className="btn primary" type="submit" disabled={isBusy} data-analytics-event="payment_started">
            {isBusy ? "Working…" : "Get payment terms"}
          </button>
        </div>
        {error && (
          <p className="ar-error" id={errorId} role="alert">{error}
            {retryAfter ? ` Retry after ${retryAfter}s.` : ""}
          </p>
        )}
      </form>

      <p className="ar-status" aria-live="polite">{STATUS_TEXT[state]}</p>

      {state === STATES.PAYMENT_REQUIRED && terms && (
        <div className="ar-terms" aria-label="Live payment terms">
          <h2>Review before you pay</h2>
          <p className="sub">These terms are the live x402 challenge from the API — nothing here is hardcoded in your browser.</p>
          <dl className="ar-dl">
            <div><dt>Amount</dt><dd><strong>{terms.amount_usdc} {terms.asset_name}</strong> <span className="muted">({terms.amount_atomic} atomic)</span></dd></div>
            <div><dt>Network</dt><dd>{terms.network} <span className="muted">(Base mainnet)</span></dd></div>
            <div><dt>Asset</dt><dd><code>{terms.asset}</code></dd></div>
            <div><dt>Pay to</dt><dd><code>{terms.pay_to}</code></dd></div>
            <div><dt>Audited resource</dt><dd><code>{terms.resource}</code></dd></div>
            <div><dt>Protocol</dt><dd>x402 v{terms.x402_version} · scheme {terms.scheme}</dd></div>
          </dl>

          {walletAvailable ? (
            <button className="btn primary" type="button" onClick={() => { setState(STATES.AWAITING_SIGNATURE); track("payment_started"); }}>
              Pay {terms.amount_usdc} USDC &amp; run audit
            </button>
          ) : (
            <div className="ar-instructions">
              <p className="sub">No in-browser x402 wallet detected. Complete the payment from any x402 v2 client — the audit returns automatically once payment settles:</p>
              <div className="ar-code">
                <div className="ar-code-head"><span>JavaScript / TypeScript</span>
                  <button type="button" className="btn small" onClick={() => copy("js", code.js)}>{copied === "js" ? "Copied" : "Copy"}</button>
                </div>
                <pre><code>{code.js}</code></pre>
              </div>
              <div className="ar-code">
                <div className="ar-code-head"><span>cURL</span>
                  <button type="button" className="btn small" onClick={() => copy("curl", code.curl)}>{copied === "curl" ? "Copied" : "Copy"}</button>
                </div>
                <pre><code>{code.curl}</code></pre>
              </div>
              <p className="fine">Canonical endpoint: <code>{endpoint}</code></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
