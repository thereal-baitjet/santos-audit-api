// Minimal Resend email sender via the REST API (no SDK dependency).
// Sender defaults to reports@santosautomation.com; if that domain is not yet
// verified in Resend, set RESEND_SENDER=onboarding@resend.dev as a fallback.
// Fails soft: returns { ok:false } instead of throwing, so a mail hiccup never
// loses a paid purchase (the report is already stored and retrievable).
const DEFAULT_SENDER = "Santos Website Intelligence <reports@santosautomation.com>";

async function send({ to, subject, text }) {
  // RESEND_API_KEY is canonical; RESEND_API is accepted because the Vercel
  // project provisions it under that name.
  const apiKey = process.env.RESEND_API_KEY ?? process.env.RESEND_API;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY not configured" };
  const from = process.env.RESEND_SENDER || DEFAULT_SENDER;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `Resend HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e.message ?? e) };
  }
}

const MONITORING_FOOTER = [
  "Want to know when this score changes? Santos Monitoring re-audits weekly",
  "and emails you on regressions — $9/mo at https://www.santosautomation.com/monitoring",
];

export async function sendReportEmail({ to, reportUrl, targetUrl, tier = "quick", score, indexAverage }) {
  const isDeep = tier === "deep";
  const label = isDeep ? "Deep Website Intelligence Report" : "Agent Readiness Report (Quick)";
  const subject = `Your ${label} is ready`;

  const lines = [
    `Your ${label} is ready.`,
    "",
    `Target audited: ${targetUrl}`,
  ];
  if (Number.isFinite(score) && Number.isFinite(indexAverage)) {
    lines.push(
      `You scored ${score}/100 — the Santos Index average across 300+ audited sites is ${indexAverage}.`
    );
  } else if (Number.isFinite(score)) {
    lines.push(`You scored ${score}/100.`);
  }
  lines.push(
    "",
    "View your report (private link — keep it to yourself):",
    reportUrl,
    "",
    "The link stays live for 30 days.",
    "",
    "The report covers how discoverable, understandable, callable, and trustworthy",
    "your site is to AI agents, with evidence and prioritized fixes.",
    "",
    ...MONITORING_FOOTER,
    "",
    "Questions or a refund request? Reply to this email or contact info@santosautomation.com.",
    "",
    "— Santos Website Intelligence"
  );

  return send({ to, subject, text: lines.join("\n") });
}

// One-time 6-digit code for the verified-email free tier. Valid 10 minutes.
export async function sendVerificationEmail({ to, code }) {
  const text = [
    `Your Santos verification code is: ${code}`,
    "",
    "Enter it in the audit widget to unlock today's free audit.",
    "The code expires in 10 minutes. If you did not request it, ignore this email.",
    "",
    "— Santos Website Intelligence",
  ].join("\n");

  return send({ to, subject: `${code} — your Santos verification code`, text });
}

// Instant summary of the verified-email free audit. publicReportUrl is the
// leaderboard listing link when the user opted in (Phase B wires it; pass
// null until then).
export async function sendFreeReportEmail({ to, targetUrl, score, topIssues, publicReportUrl }) {
  const issues = (topIssues ?? []).slice(0, 5);
  const lines = [
    "Your free Website Intelligence audit is done.",
    "",
    `Target audited: ${targetUrl}`,
    `AI Website Intelligence score: ${score ?? "N/A"}/100`,
    "",
  ];
  if (issues.length) {
    lines.push("Top issues:", ...issues.map((issue) => `- ${issue}`), "");
  } else {
    lines.push("No issues found in the completed checks.", "");
  }
  if (publicReportUrl) {
    lines.push("Your public report (leaderboard listing):", publicReportUrl, "");
  } else {
    lines.push("Free quota resets at midnight UTC — run again tomorrow.", "");
  }
  lines.push(
    "Want the complete machine-interface assessment?",
    "- One-time human reports by card — $9 Quick or $29 Deep (browser-rendered): https://www.santosautomation.com/agent-readiness/buy",
    "- Paid API for agents (x402, 0.015 USDC/audit): https://api.santosautomation.com/api/audit?url=…",
    "",
    "— Santos Website Intelligence"
  );

  return send({ to, subject: `Your free audit of ${targetUrl} — score ${score ?? "N/A"}/100`, text: lines.join("\n") });
}

// Santos Monitoring (weekly re-audit subscription) emails. Every one carries
// a "Manage or unsubscribe" footer link (manageUrl is HMAC-signed per
// subscription, see lib/monitoring/tokens.js).

export async function sendMonitoringWelcomeEmail({ to, targetUrl, score, manageUrl }) {
  const text = [
    "Welcome to Santos Monitoring.",
    "",
    `We're now watching: ${targetUrl}`,
    `Your first AI Website Intelligence score: ${score ?? "N/A"}/100`,
    "",
    "What to expect:",
    "- A weekly re-audit of your site, same checks as your paid report.",
    "- An email alert whenever your score moves 5 points or more.",
    "- A short monthly digest when everything is stable.",
    "",
    `Manage or unsubscribe: ${manageUrl}`,
    "",
    "— Santos Website Intelligence",
  ].join("\n");

  return send({ to, subject: `Monitoring is on for ${targetUrl}`, text });
}

export async function sendRegressionAlertEmail({ to, targetUrl, oldScore, newScore, topIssues = [], manageUrl }) {
  const lines = [
    `Your score moved: ${oldScore ?? "N/A"}/100 → ${newScore ?? "N/A"}/100.`,
    "",
    `Target: ${targetUrl}`,
    "",
  ];
  const issues = (topIssues ?? []).slice(0, 5);
  if (issues.length) {
    lines.push("What changed:", ...issues.map((issue) => `- ${issue}`), "");
  }
  lines.push(
    "Re-run your full report for the detailed evidence and fixes:",
    "https://www.santosautomation.com/agent-readiness/buy",
    "",
    `Manage or unsubscribe: ${manageUrl}`,
    "",
    "— Santos Website Intelligence"
  );

  return send({
    to,
    subject: `Score moved: ${targetUrl} ${oldScore ?? "N/A"} → ${newScore ?? "N/A"}`,
    text: lines.join("\n"),
  });
}

export async function sendMonitoringDigestEmail({ to, targetUrl, score, manageUrl }) {
  const text = [
    "Your monthly Santos Monitoring digest.",
    "",
    `Target: ${targetUrl}`,
    `Current score: ${score ?? "N/A"}/100`,
    "",
    "All stable — no score moves of 5 points or more since the last digest.",
    "Weekly re-audits continue; we'll email you the moment something regresses.",
    "",
    `Manage or unsubscribe: ${manageUrl}`,
    "",
    "— Santos Website Intelligence",
  ].join("\n");

  return send({ to, subject: `Monthly digest: ${targetUrl} holding at ${score ?? "N/A"}/100`, text });
}

export async function sendPaymentFailedEmail({ to, manageUrl }) {
  const text = [
    "We couldn't charge your card for Santos Monitoring.",
    "",
    "Weekly re-audits and regression alerts are paused until the payment",
    "goes through. Update your payment method to keep monitoring running:",
    "",
    `Manage or unsubscribe: ${manageUrl}`,
    "",
    "— Santos Website Intelligence",
  ].join("\n");

  return send({ to, subject: "Payment failed — keep Santos Monitoring running", text });
}
