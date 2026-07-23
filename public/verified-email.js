// SantosVerify — shared verified-email token flow for the free-tier widgets
// (quick audit today; the Phase C llms.txt generator reuses this module).
//
//   window.SantosVerify = {
//     getToken()                       // stored token or null
//     getEmail()                       // email the token was issued to, or null
//     ensureVerified({ widget, email, url, statusNode, source })
//                                      // → Promise<token|null>
//   }
//
// ensureVerified POSTs a 6-digit code request, swaps the widget's status area
// for a code-entry form, and resolves with the 30-day token once the code
// confirms (stored in localStorage). Resolves null if the code request could
// not be sent; the caller keeps control of the status area afterwards.
(() => {
  const TOKEN_KEY = "santos_token";
  const EMAIL_KEY = "santos_email";

  const announce = (name) => window.dispatchEvent(new CustomEvent("santos:analytics", { detail: { name } }));
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  };
  const getEmail = () => {
    try { return localStorage.getItem(EMAIL_KEY); } catch { return null; }
  };
  const store = (token, email) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EMAIL_KEY, email);
    } catch { /* private mode: token just won't persist */ }
  };

  function ensureVerified({ email, url, statusNode, source = "audit-widget" }) {
    return new Promise(async (resolve) => {
      let requested = false;
      try {
        const res = await fetch("/api/leads/verify/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, url, source }),
        });
        requested = res.ok;
      } catch { /* fall through */ }
      if (!requested) {
        statusNode.className = "audit-status error";
        statusNode.textContent = "Could not send a verification code right now. Try again in a moment.";
        resolve(null);
        return;
      }
      announce("email_verification_requested");

      // Swap the status area for the code-entry form.
      statusNode.className = "audit-status";
      statusNode.replaceChildren();
      const note = element("p", "", `We emailed a 6-digit code to ${email}. Enter it to run your audit:`);
      const codeForm = element("form", "audit-form");
      const input = element("input");
      input.type = "text";
      input.name = "code";
      input.inputMode = "numeric";
      input.pattern = "[0-9]{6}";
      input.maxLength = 6;
      input.placeholder = "123456";
      input.autocomplete = "one-time-code";
      input.required = true;
      const submit = element("button", "btn primary", "Verify & run audit");
      submit.type = "submit";
      codeForm.append(input, submit);
      const error = element("p", "error");
      error.hidden = true;
      statusNode.append(note, codeForm, error);
      input.focus();

      codeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const code = input.value.trim();
        if (!/^\d{6}$/.test(code)) return;
        submit.disabled = true;
        error.hidden = true;
        try {
          const res = await fetch("/api/leads/verify/confirm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, code }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.token) {
            error.textContent = data.error ?? "Verification failed. Try again.";
            error.hidden = false;
            submit.disabled = false;
            return;
          }
          store(data.token, email);
          announce("email_verified");
          statusNode.className = "audit-status spinner";
          statusNode.textContent = "Verified — running your audit …";
          resolve(data.token);
        } catch {
          error.textContent = "Could not reach the verification API. Try again in a moment.";
          error.hidden = false;
          submit.disabled = false;
        }
      });
    });
  }

  window.SantosVerify = { getToken, getEmail, ensureVerified };
})();
