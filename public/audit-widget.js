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

  // Demo quota exhausted (429): show the reason, then offer to email tomorrow's
  // free audit instead — the human conversion path for an agent-only paywall.
  function renderLeadCapture(widget, target, message) {
    const status = widget.querySelector("[data-audit-status]");
    status.className = "audit-status error";
    status.textContent = message;
    let box = widget.querySelector("[data-lead-capture]");
    if (!box) {
      box = element("div", "lead-capture");
      box.setAttribute("data-lead-capture", "");
      status.after(box);
    }
    box.replaceChildren();
    box.append(element("p", "", "Want tomorrow's free audit emailed to you? Leave your email:"));
    const leadForm = element("form", "audit-form");
    const input = element("input");
    input.type = "email";
    input.name = "email";
    input.placeholder = "you@example.com";
    input.required = true;
    const submit = element("button", "btn primary", "Email me the audit");
    submit.type = "submit";
    leadForm.append(input, submit);
    box.append(leadForm);
    leadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: input.value.trim(), url: target, source: "audit-widget" }),
        });
        if (!res.ok) throw new Error();
        box.replaceChildren(element("p", "clean", "Thanks — we'll email you a link when your free quota resets."));
      } catch {
        submit.disabled = false;
        box.append(element("p", "audit-status error", "Could not save that right now. Please try again tomorrow."));
      }
    });
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

  document.querySelectorAll("[data-audit-widget]").forEach((widget) => {
    if (widget.dataset.ready === "true") return;
    widget.dataset.ready = "true";
    const form = widget.querySelector("[data-audit-form]");
    const status = widget.querySelector("[data-audit-status]");
    const button = form.querySelector("button");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = new FormData(form).get("url")?.trim();
      if (!target) return;
      // free_audit_started fires from the button's data-analytics-event click.
      button.disabled = true;
      status.className = "audit-status spinner";
      status.textContent = `Auditing ${target} …`;
      widget.querySelector("[data-audit-result]").hidden = true;
      try {
        const response = await fetch(`/api/audit/demo?url=${encodeURIComponent(target)}`);
        const data = await response.json();
        if (response.status === 429) {
          renderLeadCapture(widget, target, data.error ?? "Free demo limit reached for today.");
          announce("free_audit_failed");
          return;
        }
        if (!response.ok) throw new Error(data.error ?? "Audit failed");
        widget.querySelector("[data-lead-capture]")?.remove();
        render(widget, data);
        status.textContent = "Audit complete.";
        status.className = "audit-status clean";
        announce("free_audit_completed");
      } catch (error) {
        status.textContent = error.message || "Could not reach the audit API. Try again in a moment.";
        status.className = "audit-status error";
        announce("free_audit_failed");
      } finally {
        button.disabled = false;
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
