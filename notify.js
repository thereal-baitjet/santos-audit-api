// Fire-and-forget Discord notification for a settled x402 payment.
// Never throws — a notification failure must never affect the paid response.
import { redactUrl } from "./lib/redact.js";

// Ops warning channel: loud, fire-and-forget Discord alert for failures a
// customer would otherwise discover before we do (e.g. email delivery down).
// Never throws, same contract as notifyTransaction.
export async function notifyOpsAlert({ title, detail, fields = [], urgent = false }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    // Loud in logs: an alert nobody receives is worse than no alert, because it
    // is mistaken for silence meaning "nothing is wrong".
    console.error(`ops alert not delivered (DISCORD_WEBHOOK_URL unset): ${title} — ${detail}`);
    return { delivered: false, reason: "no_webhook" };
  }
  const body = {
    // An urgent incident should be visually distinct from a routine warning at
    // a glance, and content mentions surface on mobile without a role ping.
    content: urgent ? `@here **${title}**` : undefined,
    embeds: [{
      title: `${urgent ? "🚨" : "⚠️"} ${title}`,
      color: urgent ? 15158332 : 13956054, // red for incidents, orange for warnings
      description: String(detail ?? "unknown").slice(0, 2000),
      fields: fields.slice(0, 10).map((f) => ({
        name: String(f.name).slice(0, 256),
        value: String(f.value).slice(0, 1024),
        inline: Boolean(f.inline),
      })),
      timestamp: new Date().toISOString(),
    }],
  };
  try {
    // A hung Discord must never hold a request open. The caller awaits this so
    // the POST actually flushes before a serverless instance is frozen, so the
    // timeout is what keeps that safe.
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.error(`Discord ops alert rejected: HTTP ${res.status} — ${title}`);
      return { delivered: false, reason: `http_${res.status}` };
    }
    return { delivered: true };
  } catch (e) {
    console.error("Discord ops alert failed:", e.message, "—", title);
    return { delivered: false, reason: e.name === "TimeoutError" ? "timeout" : "error" };
  }
}

export async function notifyTransaction({ url, payer, transaction, network, amount, rail = "x402" }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  url = redactUrl(url); // never forward customer query strings/tokens to Discord

  const isCard = rail === "stripe";
  const isMainnet = network === "base" || network === "eip155:8453";
  const explorer = isMainnet ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";

  const embed = isCard
    ? {
        title: `💳 Card revenue — $${amount} USD received`,
        color: 13935182,
        fields: [
          { name: "Audited", value: `\`${url}\``, inline: false },
          { name: "Product", value: "Agent Readiness Report", inline: true },
          { name: "Rail", value: "Stripe (card)", inline: true },
        ],
        timestamp: new Date().toISOString(),
      }
    : {
        title: `💰 Audit API — $${amount} USDC received`,
        url: transaction ? `${explorer}${transaction}` : undefined,
        color: 13935182, // brass, matches the site accent
        fields: [
          { name: "Audited", value: `\`${url}\``, inline: false },
          { name: "Payer", value: `\`${payer}\``, inline: true },
          { name: "Network", value: network, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (e) {
    console.error("Discord notify failed:", e.message);
  }
}
