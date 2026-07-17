// Fire-and-forget Discord notification for a settled x402 payment.
// Never throws — a notification failure must never affect the paid response.
export async function notifyTransaction({ url, payer, transaction, network, amount }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const explorer = network === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";

  const embed = {
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
