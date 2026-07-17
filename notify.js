// Fire-and-forget Slack notification for a settled x402 payment.
// Never throws — a notification failure must never affect the paid response.
export async function notifyTransaction({ url, payer, transaction, network, amount }) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  const explorer = network === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";
  const lines = [
    `:moneybag: *Audit API — $${amount} USDC received*`,
    `• Audited: \`${url}\``,
    `• Payer: \`${payer}\``,
    `• Network: ${network}`,
    transaction ? `• <${explorer}${transaction}|View transaction on BaseScan>` : null,
  ].filter(Boolean);

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch (e) {
    console.error("Slack notify failed:", e.message);
  }
}
