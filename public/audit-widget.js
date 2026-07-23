(() => {
  const grade = (score) => score >= 80 ? "good" : score >= 55 ? "warn" : "bad";
  const labels = {
    performance: "Performance",
    seo: "Technical SEO",
    accessibility: "Accessibility",
    security: "Security",
  };

  const announce = (name) => window.dispatchEvent(new CustomEvent("santos:analytics", { detail: { name } }));
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // Daily quota exhausted (429): explain the verified-email limit and point at
  // the paid paths — email is already captured up front, so there is no
  // lead-capture fallback anymore.
  function renderLockedOut(widget, message) {
    const status = widget.querySelector("[data-audit-status]");
    status.className = "audit-status error";
    status.textContent = message;
    let box = widget.querySelector("[data-locked-out]");
    if (!box) {
      box = element("div", "locked-out");
      box.setAttribute("data-locked-out", "");
      status.after(box);
    }
    box.replaceChildren();
    box.append(element("p", "", "Locked out until midnight UTC — one free audit per day per verified email."));
    const links = element("p", "locked-out-links");
    const card = element("a", "", "$5 Agent Readiness Report by card");
    card.href = "/agent-readiness/buy";
    const api = element("a", "", "Paid API (x402, $0.015/audit)");
    api.href = "/openapi.json";
    links.append(card, document.createTextNode(" · "), api);
    box.append(links);
    announce("free_audit_locked_out");
  }

  function scoreCard(label, score, primary = false) {
    const card = element("div", `score-card${primary ? " score-card--primary" : ""}`);
    card.append(element("div", `num ${grade(score)}`, String(score)));
    card.append(element("div", "lbl", label));
    return card;
  }

  function render(widget, data) {
    const scoreRow = widget.querySelector("[data-score-row]");
    const dimensions = widget.querySelector("[data-dimensions]");
    const issuesBox = widget.querySelector("[data-issues]");
    scoreRow.replaceChildren();
    issuesBox.replaceChildren();

    if (Number.isInteger(data.website_intelligence_score)) {
      scoreRow.append(scoreCard("AI Website Intelligence", data.website_intelligence_score, true));
    }
    scoreRow.append(scoreCard("Legacy overall", data.overall_score));
    Object.entries(data.scores ?? {}).forEach(([key, score]) => {
      if (Number.isInteger(score)) scoreRow.append(scoreCard(labels[key] ?? key.replaceAll("_", " "), score));
    });

    dimensions.replaceChildren();
    const dimensionScores = data.website_intelligence?.dimensions;
    if (dimensionScores) {
      Object.entries(dimensionScores).forEach(([key, score]) => {
        const row = element("div");
        row.append(element("span", "", key));
        row.append(element("strong", score == null ? "muted-score" : grade(score), score == null ? "N/A" : String(score)));
        dimensions.append(row);
      });
      dimensions.hidden = false;
    } else {
      dimensions.hidden = true;
    }

    if (data.issues?.length) {
      const list = element("ul", "issues");
      data.issues.forEach((issue) => list.append(element("li", "", issue)));
      issuesBox.append(list);
    } else {
      issuesBox.append(element("p", "clean", "No issues found in the completed checks."));
    }
    widget.querySelector("[data-audit-result]").hidden = false;
  }

  const runAudit = (target, token, isPublic) =>
    fetch(`/api/audit/free?url=${encodeURIComponent(target)}&token=${encodeURIComponent(token)}&public=${isPublic ? "1" : "0"}`);

  document.querySelectorAll("[data-audit-widget]").forEach((widget) => {
    if (widget.dataset.ready === "true") return;
    widget.dataset.ready = "true";
    const form = widget.querySelector("[data-audit-form]");
    const status = widget.querySelector("[data-audit-status]");
    const button = form.querySelector("button");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const target = data.get("url")?.trim();
      const email = data.get("email")?.trim().toLowerCase();
      const isPublic = data.get("public") != null;
      if (!target || !email) return;
      // free_audit_started fires from the button's data-analytics-event click.
      button.disabled = true;
      status.className = "audit-status spinner";
      status.textContent = `Auditing ${target} …`;
      widget.querySelector("[data-audit-result]").hidden = true;
      widget.querySelector("[data-locked-out]")?.remove();
      try {
        // A stored token only counts when it was issued to this email.
        let token = window.SantosVerify?.getToken();
        if (token && window.SantosVerify.getEmail() !== email) token = null;

        if (token) {
          const first = await runAudit(target, token, isPublic);
          if (first.status !== 401) {
            await handle(first);
            return;
          }
          // 401: token expired or never verified — fall through to verification.
        }

        token = await window.SantosVerify.ensureVerified({ email, url: target, statusNode: status });
        if (!token) {
          announce("free_audit_failed");
          return;
        }
        status.className = "audit-status spinner";
        status.textContent = `Auditing ${target} …`;
        await handle(await runAudit(target, token, isPublic));
      } catch (error) {
        status.textContent = error.message || "Could not reach the audit API. Try again in a moment.";
        status.className = "audit-status error";
        announce("free_audit_failed");
      } finally {
        button.disabled = false;
      }

      async function handle(response) {
        const body = await response.json();
        if (response.status === 429) {
          renderLockedOut(widget, body.error ?? "Free audit limit reached for today.");
          announce("free_audit_failed");
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "Audit failed");
        widget.querySelector("[data-locked-out]")?.remove();
        render(widget, body);
        status.textContent = "Audit complete. Full summary emailed to you.";
        status.className = "audit-status clean";
        announce("free_audit_completed");
      }
    });
  });

  // Click tracking for [data-analytics-event] elements is handled app-wide by
  // AnalyticsBoot (lib/analytics-client.js) — a second binding here would
  // double-count every event.

  const pricing = document.querySelector('[data-analytics-event="pricing_viewed"]');
  if (pricing && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        announce("pricing_viewed");
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(pricing);
  }
})();
