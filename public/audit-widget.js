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
      announce("quick_audit_started");
      button.disabled = true;
      status.className = "audit-status spinner";
      status.textContent = `Auditing ${target} …`;
      widget.querySelector("[data-audit-result]").hidden = true;
      try {
        const response = await fetch(`/api/audit/demo?url=${encodeURIComponent(target)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Audit failed");
        render(widget, data);
        status.textContent = "Audit complete.";
        status.className = "audit-status clean";
        announce("quick_audit_completed");
      } catch (error) {
        status.textContent = error.message || "Could not reach the audit API. Try again in a moment.";
        status.className = "audit-status error";
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-analytics-event]").forEach((target) => {
    if (target.dataset.analyticsEvent === "quick_audit_started") return;
    target.addEventListener("click", () => announce(target.dataset.analyticsEvent));
  });

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
