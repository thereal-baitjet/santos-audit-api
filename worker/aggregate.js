// Report aggregator: normalizes engine outputs into the versioned report.
// Every score is deterministic and traceable to the documented formula below;
// no LLM touches scores, metrics, or pass/fail states.
export const SCORING_METHOD = {
  performance: "Lighthouse performance category score (0-100, engine-native, lab data).",
  seo: "Lighthouse SEO category score (0-100, engine-native).",
  accessibility:
    "Start at 100; subtract per distinct rendered axe-core violation: critical -15, serious -10, moderate -5, minor -2 (floor 0). Automated checks cannot establish WCAG conformance.",
  security:
    "Passed passive checks / total applicable passive checks * 100 (transport, headers, cookie flags, mixed content).",
  overall: "Arithmetic mean of the category scores whose modules completed.",
};

const AXE_SEVERITY = { critical: "critical", serious: "serious", moderate: "moderate", minor: "minor" };
const AXE_PENALTY = { critical: 15, serious: 10, moderate: 5, minor: 2 };

function finding({ id, engine, category, severity, confidence = "high", status, title, description, evidence, standards, recommendation }) {
  return { id, engine, category, severity, confidence, status, title, description, evidence, standards, recommendation };
}

export function normalizeAxe(axeResults) {
  const findings = [];
  if (!axeResults || axeResults.error) return { findings, error: axeResults?.error };
  for (const v of axeResults.violations ?? []) {
    findings.push(finding({
      id: `a11y.${v.id}`,
      engine: "axe-core",
      category: "accessibility",
      severity: AXE_SEVERITY[v.impact] ?? "moderate",
      status: "fail",
      title: v.help,
      description: v.description,
      evidence: {
        nodes: (v.nodes ?? []).slice(0, 5).map((n) => ({ selector: n.target?.join(" "), summary: n.failureSummary?.slice(0, 300) })),
        affected_count: v.nodes?.length ?? 0,
      },
      standards: (v.tags ?? []).filter((t) => t.startsWith("wcag")),
      recommendation: v.helpUrl ? `${v.help}. Guidance: ${v.helpUrl}` : v.help,
    }));
  }
  for (const inc of axeResults.incomplete ?? []) {
    findings.push(finding({
      id: `a11y.${inc.id}`,
      engine: "axe-core",
      category: "accessibility",
      severity: AXE_SEVERITY[inc.impact] ?? "moderate",
      confidence: "low",
      status: "needs_manual_review",
      title: inc.help,
      description: `Automated analysis could not determine pass/fail: ${inc.description}`,
      evidence: { affected_count: inc.nodes?.length ?? 0 },
      standards: (inc.tags ?? []).filter((t) => t.startsWith("wcag")),
      recommendation: "Review manually; automated tooling could not decide this check.",
    }));
  }
  return { findings, passes: axeResults.passes?.length ?? 0 };
}

export function normalizeLighthouse(lhr) {
  const findings = [];
  if (!lhr) return { findings, scores: {}, metrics: {} };
  const scores = Object.fromEntries(
    Object.entries(lhr.categories ?? {}).map(([k, c]) => [k, c.score == null ? null : Math.round(c.score * 100)])
  );
  const metric = (id) => lhr.audits?.[id]?.numericValue;
  const metrics = {
    first_contentful_paint_ms: metric("first-contentful-paint"),
    largest_contentful_paint_ms: metric("largest-contentful-paint"),
    cumulative_layout_shift: metric("cumulative-layout-shift"),
    total_blocking_time_ms: metric("total-blocking-time"),
    speed_index_ms: metric("speed-index"),
  };
  for (const [id, audit] of Object.entries(lhr.audits ?? {})) {
    const isOpportunity = audit.details?.type === "opportunity" || audit.scoreDisplayMode === "metricSavings";
    if (audit.score != null && audit.score < 0.9 && isOpportunity) {
      findings.push(finding({
        id: `perf.${id}`,
        engine: "lighthouse",
        category: "performance",
        severity: audit.score < 0.5 ? "serious" : "moderate",
        status: "fail",
        title: audit.title,
        description: audit.description?.replace(/\[Learn[^\]]*\]\([^)]*\)\.?/g, "").trim(),
        evidence: { score: audit.score, display_value: audit.displayValue, savings_ms: audit.details?.overallSavingsMs },
        recommendation: audit.title,
      }));
    }
  }
  return { findings, scores, metrics };
}

export function passiveSecurity(evidence, targetUrl) {
  const h = evidence.main_response?.headers ?? {};
  const get = (name) => h[name] ?? h[name.toLowerCase()];
  const https = targetUrl.startsWith("https://");
  const csp = get("content-security-policy");
  const checks = [];
  const add = (id, pass, title, rec, severity = "moderate", evidenceData) =>
    checks.push({ id, pass, title, rec, severity, evidence: evidenceData });

  add("sec.https", https, "Serves over HTTPS", "Serve the page over HTTPS.", "critical");
  add("sec.hsts", !!get("strict-transport-security"), "Strict-Transport-Security header", "Add an HSTS header (e.g. max-age=31536000; includeSubDomains).", "serious");
  add("sec.csp", !!csp, "Content-Security-Policy header", "Add a restrictive Content-Security-Policy and test before enforcing.", "serious");
  if (csp) {
    add("sec.csp-unsafe-inline", !/unsafe-inline/.test(csp), "CSP avoids 'unsafe-inline'", "Remove 'unsafe-inline' from script/style sources; use nonces or hashes.", "moderate", { directive: "unsafe-inline present" });
    add("sec.csp-unsafe-eval", !/unsafe-eval/.test(csp), "CSP avoids 'unsafe-eval'", "Remove 'unsafe-eval'.", "moderate");
    add("sec.csp-frame-ancestors", /frame-ancestors/.test(csp) || !!get("x-frame-options"), "Clickjacking protection", "Add frame-ancestors to CSP or an X-Frame-Options header.", "moderate");
  } else {
    add("sec.clickjacking", !!get("x-frame-options"), "Clickjacking protection", "Add X-Frame-Options or a CSP frame-ancestors directive.", "moderate");
  }
  add("sec.xcto", (get("x-content-type-options") ?? "").toLowerCase().includes("nosniff"), "X-Content-Type-Options: nosniff", "Add X-Content-Type-Options: nosniff.", "minor");
  add("sec.referrer-policy", !!get("referrer-policy"), "Referrer-Policy header", "Add a Referrer-Policy (e.g. strict-origin-when-cross-origin).", "minor");
  add("sec.permissions-policy", !!get("permissions-policy"), "Permissions-Policy header", "Add a Permissions-Policy limiting powerful features.", "info");
  add("sec.mixed-content", evidence.mixed_content.length === 0, "No mixed content", "Load all subresources over HTTPS.", "serious", { insecure_requests: evidence.mixed_content.slice(0, 10) });
  add("sec.insecure-forms", evidence.insecure_forms.length === 0, "No forms posting to HTTP", "Point form actions at HTTPS endpoints.", "critical", { actions: evidence.insecure_forms });

  const server = get("server") ?? "";
  const powered = get("x-powered-by") ?? "";
  add("sec.version-disclosure", !/\d/.test(server) && !powered, "No server/framework version disclosure",
    "Strip version numbers from Server and remove X-Powered-By.", "info", { server: server || undefined, x_powered_by: powered || undefined });

  const insecureCookies = evidence.cookies.filter((c) => !c.secure || !c.httpOnly);
  add("sec.cookie-flags", evidence.cookies.length === 0 || insecureCookies.length === 0, "Cookies use Secure + HttpOnly",
    "Set Secure and HttpOnly (and an appropriate SameSite) on cookies.", "moderate",
    { insecure_cookie_names: insecureCookies.map((c) => c.name).slice(0, 10) });

  const findings = checks.map((c) =>
    finding({
      id: c.id, engine: "santos-passive-security", category: "security",
      severity: c.pass ? "info" : c.severity, status: c.pass ? "pass" : "fail",
      title: c.title, description: c.pass ? `${c.title}: present/OK` : `${c.title}: missing or weak`,
      evidence: c.evidence, recommendation: c.rec,
    })
  );
  const applicable = checks.length;
  const passed = checks.filter((c) => c.pass).length;
  return { findings, score: Math.round((passed / applicable) * 100) };
}

export function networkFindings(evidence) {
  const findings = [];
  if (evidence.console_errors.length > 0) {
    findings.push(finding({
      id: "net.console-errors", engine: "playwright", category: "quality",
      severity: evidence.console_errors.length > 5 ? "serious" : "moderate", status: "fail",
      title: `${evidence.console_errors.length} browser console error(s)`,
      description: "Errors logged to the console during page load.",
      evidence: { samples: evidence.console_errors.slice(0, 10) },
      recommendation: "Fix JavaScript errors surfaced in the browser console.",
    }));
  }
  if (evidence.page_errors.length > 0) {
    findings.push(finding({
      id: "net.uncaught-exceptions", engine: "playwright", category: "quality",
      severity: "serious", status: "fail",
      title: `${evidence.page_errors.length} uncaught JavaScript exception(s)`,
      description: "Uncaught exceptions thrown during page load.",
      evidence: { samples: evidence.page_errors.slice(0, 10) },
      recommendation: "Fix uncaught exceptions; they can break page functionality.",
    }));
  }
  const failed = evidence.failed_requests.filter((r) => r.error && !r.error.includes("BLOCKED_BY_CLIENT"));
  if (failed.length > 0) {
    findings.push(finding({
      id: "net.failed-requests", engine: "playwright", category: "quality",
      severity: "moderate", status: "fail",
      title: `${failed.length} failed network request(s)`,
      description: "Subresource requests that failed during load.",
      evidence: { samples: failed.slice(0, 10) },
      recommendation: "Fix or remove references to failing resources.",
    }));
  }
  if (evidence.third_party_domains.length > 15) {
    findings.push(finding({
      id: "net.third-party-sprawl", engine: "playwright", category: "performance",
      severity: "moderate", confidence: "medium", status: "warning",
      title: `${evidence.third_party_domains.length} third-party domains contacted`,
      description: "Heavy third-party usage adds latency, privacy exposure, and failure modes.",
      evidence: { domains: evidence.third_party_domains.slice(0, 25) },
      recommendation: "Audit third-party scripts; remove or defer non-essential ones.",
    }));
  }
  return findings;
}

export function accessibilityScore(findings) {
  let score = 100;
  const seen = new Set();
  for (const f of findings) {
    if (f.engine === "axe-core" && f.status === "fail" && !seen.has(f.id)) {
      seen.add(f.id);
      score -= AXE_PENALTY[f.severity] ?? 5;
    }
  }
  return Math.max(0, score);
}
