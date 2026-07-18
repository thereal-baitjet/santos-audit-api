// Minimal Resend email sender via the REST API (no SDK dependency).
// Sender defaults to reports@santosautomation.com; if that domain is not yet
// verified in Resend, set RESEND_SENDER=onboarding@resend.dev as a fallback.
// Fails soft: returns { ok:false } instead of throwing, so a mail hiccup never
// loses a paid purchase (the report is already stored and retrievable).
const DEFAULT_SENDER = "Santos Website Intelligence <reports@santosautomation.com>";

export async function sendReportEmail({ to, reportUrl, targetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY not configured" };
  const from = process.env.RESEND_SENDER || DEFAULT_SENDER;

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Agent Readiness Report is ready",
        text,
      }),
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
