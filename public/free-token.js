// Free-tier token issuer.
//
// The three free MCP tools key their daily quota on the caller IP unless a
// verified-email token is passed. Agents hosted by Claude or Grok reach the API
// from shared infrastructure, so the IP allowance is spent by whoever calls
// first — this page is how an individual user obtains their own.
//
// Reuses window.SantosVerify (verified-email.js) for the code request and
// confirmation; the only thing added here is showing the resulting token so it
// can be pasted into an MCP client.
(() => {
  const root = document.querySelector("[data-token-widget]");
  if (!root) return;

  const form = root.querySelector("[data-token-form]");
  const emailInput = root.querySelector("[data-token-email]");
  const status = root.querySelector("[data-token-status]");
  const result = root.querySelector("[data-token-result]");
  const output = root.querySelector("[data-token-value]");
  const copyBtn = root.querySelector("[data-token-copy]");
  const examples = root.querySelectorAll("[data-token-example]");

  const announce = (name) =>
    window.dispatchEvent(new CustomEvent("santos:analytics", { detail: { name } }));

  const show = (token) => {
    output.textContent = token;
    // Splice the real token into every copyable example on the page.
    examples.forEach((node) => {
      const template = node.getAttribute("data-token-example");
      node.textContent = template.replace("<token>", token);
    });
    result.hidden = false;
    status.textContent = "";
    announce("free_token_issued");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // A token already in localStorage from an earlier visit or widget use.
  const existing = window.SantosVerify?.getToken?.();
  if (existing) {
    show(existing);
    status.textContent = `Reusing the token already issued to ${window.SantosVerify.getEmail() ?? "this browser"}.`;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      status.textContent = "Enter the email address to issue the token to.";
      return;
    }
    status.textContent = "Sending a 6-digit code…";
    announce("free_token_requested");
    try {
      const token = await window.SantosVerify.ensureVerified({
        widget: root,
        email,
        url: "https://www.santosautomation.com/free-token",
        statusNode: status,
        source: "free-token-page",
      });
      if (token) show(token);
    } catch {
      status.textContent = "Could not issue a token right now. Please try again shortly.";
    }
  });

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.textContent ?? "");
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy token"; }, 2000);
    } catch {
      /* clipboard unavailable — the token stays selectable on the page */
    }
  });
})();
