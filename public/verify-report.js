// Verify page client: POSTs the pasted report JSON to /v1/verify and renders
// the outcome. No dependencies; mounted by app/verify/page.js (nonce-loaded).
(() => {
  const widget = document.querySelector("[data-verify-widget]");
  if (!widget) return;
  const form = widget.querySelector("[data-verify-form]");
  const result = widget.querySelector("[data-verify-result]");
  const textarea = form.querySelector("textarea");
  const button = form.querySelector("button");

  const row = (label, value) => {
    const div = document.createElement("div");
    div.className = "verify-row";
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement("code");
    val.textContent = value ?? "—";
    div.append(key, val);
    return div;
  };

  const show = (ok, title, details) => {
    result.hidden = false;
    result.className = `verify-result ${ok ? "verify-ok" : "verify-bad"}`;
    result.textContent = "";
    const heading = document.createElement("p");
    heading.className = "verify-verdict";
    heading.textContent = title;
    result.append(heading);
    (details ?? []).forEach(([label, value]) => result.append(row(label, value)));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = textarea.value.trim();
    if (!body) return;
    button.disabled = true;
    try {
      const res = await fetch("/v1/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        show(false, "Rate limited — 30 verifications per hour. Try again later.");
      } else if (!res.ok || !data || typeof data.valid !== "boolean") {
        show(false, data?.error ?? "Could not verify this report — is it the full report JSON?");
      } else if (data.valid) {
        show(true, "Signature valid — this report is authentic and unmodified.", [
          ["Audited URL", data.url],
          ["Score", data.score != null ? `${data.score}/100` : null],
          ["Signed at", data.signed_at],
        ]);
      } else {
        show(false, "Signature INVALID — this report was modified or not issued by Santos.", [
          ["Claimed URL", data.url],
          ["Claimed score", data.score != null ? `${data.score}/100` : null],
        ]);
      }
    } catch {
      show(false, "Network error — could not reach the verifier. Try again.");
    } finally {
      button.disabled = false;
    }
  });
})();
