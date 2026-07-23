// Fire-and-forget Discord notification for a settled x402 payment.
// Never throws — a notification failure must never affect the paid response.
import { redactUrl } from "./lib/redact.js";

// Ops warning channel: loud, fire-and-forget Discord alert for failures a
// customer would otherwise discover before we do (e.g. email delivery down).
// Never throws, same contract as notifyTransaction.
export async function notifyOpsAlert({ title, detail }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `⚠️ ${title}`,
          color: 13956054, // warning orange-red
          fields: [{ name: "Detail", value: String(detail ?? "unknown").slice(0, 1000), inline: false }],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (e) {
    console.error("Discord ops alert failed:", e.message);
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
