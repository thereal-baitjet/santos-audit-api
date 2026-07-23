// Minimal Resend email sender via the REST API (no SDK dependency).
// Sender defaults to reports@santosautomation.com; if that domain is not yet
// verified in Resend, set RESEND_SENDER=onboarding@resend.dev as a fallback.
// Fails soft: returns { ok:false } instead of throwing, so a mail hiccup never
// loses a paid purchase (the report is already stored and retrievable).
const DEFAULT_SENDER = "Santos Website Intelligence <reports@santosautomation.com>";

async function send({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
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

export async function sendReportEmail({ to, reportUrl, targetUrl }) {
  const text = [
    "Your Agent Readiness Report is ready.",
    "",
    `Target audited: ${targetUrl}`,
    "",
    "View your report (private link — keep it to yourself):",
    reportUrl,
    "",
    "The report covers how discoverable, understandable, callable, and trustworthy",
    "your site is to AI agents, with evidence and prioritized fixes.",
    "",
    "Questions or a refund request? Reply to this email or contact info@santosautomation.com.",
    "",
    "— Santos Website Intelligence",
  ].join("\n");

  return send({ to, subject: "Your Agent Readiness Report is ready", text });
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
    "- One-time $5 Agent Readiness Report by card: https://www.santosautomation.com/agent-readiness/buy",
    "- Paid API for agents (x402, 0.015 USDC/audit): https://api.santosautomation.com/api/audit?url=…",
    "",
    "— Santos Website Intelligence"
  );

  return send({ to, subject: `Your free audit of ${targetUrl} — score ${score ?? "N/A"}/100`, text: lines.join("\n") });
}
