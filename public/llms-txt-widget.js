// Client logic for the /llms-txt-generator widget. Reuses the shared
// verified-email flow (window.SantosVerify from /verified-email.js) and the
// same submit → 401 → verify → retry pattern as /audit-widget.js.
(() => {
  const announce = (name) => window.dispatchEvent(new CustomEvent("santos:analytics", { detail: { name } }));
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const runGenerator = (target, token) =>
    fetch(`/v1/llms-txt/demo?url=${encodeURIComponent(target)}&token=${encodeURIComponent(token)}`);

  function renderLockedOut(widget, message) {
    const status = widget.querySelector("[data-llms-status]");
    status.className = "audit-status error";
    status.textContent = message;
    let box = widget.querySelector("[data-locked-out]");
    if (!box) {
      box = element("div", "locked-out");
      box.setAttribute("data-locked-out", "");
      status.after(box);
    }
    box.replaceChildren();
    box.append(element("p", "", "Locked out until midnight UTC — one free call per day per verified email, shared across free tools."));
    const links = element("p", "locked-out-links");
    const card = element("a", "", "$5 Agent Readiness Report by card");
    card.href = "/agent-readiness/buy";
    const audit = element("a", "", "Run Agent Readiness");
    audit.href = "/agent-readiness/run";
    links.append(card, document.createTextNode(" · "), audit);
    box.append(links);
    announce("free_audit_locked_out");
  }

  function render(widget, data) {
    widget.querySelector("[data-llms-output]").textContent = data.llms_txt;
    const notesBox = widget.querySelector("[data-llms-notes]");
    notesBox.replaceChildren();
    if (data.notes?.length) {
      const list = element("ul", "issues");
      data.notes.forEach((note) => list.append(element("li", "", note)));
      notesBox.append(list);
    }
    widget.querySelector("[data-llms-result]").hidden = false;
  }

  document.querySelectorAll("[data-llms-widget]").forEach((widget) => {
    if (widget.dataset.ready === "true") return;
    widget.dataset.ready = "true";
    const form = widget.querySelector("[data-llms-form]");
    const status = widget.querySelector("[data-llms-status]");
    const button = form.querySelector("button");
    const copy = widget.querySelector("[data-llms-copy]");

    copy.addEventListener("click", async () => {
      const text = widget.querySelector("[data-llms-output]").textContent;
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = "Copied!";
      } catch {
        // Clipboard API unavailable (permissions, insecure context): select
        // the <pre> contents so the user can copy manually.
        const range = document.createRange();
        range.selectNodeContents(widget.querySelector("[data-llms-output]"));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copy.textContent = "Select & copy (Ctrl/Cmd+C)";
      }
      setTimeout(() => { copy.textContent = "Copy llms.txt"; }, 2000);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const target = data.get("url")?.trim();
      const email = data.get("email")?.trim().toLowerCase();
      if (!target || !email) return;
      button.disabled = true;
      status.className = "audit-status spinner";
      status.textContent = `Sampling ${target} …`;
      widget.querySelector("[data-llms-result]").hidden = true;
      widget.querySelector("[data-locked-out]")?.remove();
      try {
        // A stored token only counts when it was issued to this email.
        let token = window.SantosVerify?.getToken();
        if (token && window.SantosVerify.getEmail() !== email) token = null;

        if (token) {
          const first = await runGenerator(target, token);
          if (first.status !== 401) {
            await handle(first);
            return;
          }
          // 401: token expired or never verified — fall through to verification.
        }

        token = await window.SantosVerify.ensureVerified({ email, url: target, statusNode: status, source: "llms-txt-generator" });
        if (!token) return;
        status.className = "audit-status spinner";
        status.textContent = `Sampling ${target} …`;
        await handle(await runGenerator(target, token));
      } catch (error) {
        status.textContent = error.message || "Could not reach the generator API. Try again in a moment.";
        status.className = "audit-status error";
      } finally {
        button.disabled = false;
      }

      async function handle(response) {
        const body = await response.json();
        if (response.status === 429) {
          renderLockedOut(widget, body.error ?? "Free limit reached for today.");
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "Generation failed");
        widget.querySelector("[data-locked-out]")?.remove();
        render(widget, body);
        status.textContent = "Draft generated — review it before publishing to /llms.txt.";
        status.className = "audit-status clean";
        announce("llms_txt_generated");
      }
    });
  });
})();
