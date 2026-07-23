#!/usr/bin/env bash
# Agent Readiness CI gate — plain-bash version of agent-readiness-ci.yml for
# any CI system (GitLab CI, Buildkite, Jenkins, a cron job, …).
#
#   PREVIEW_URL=https://preview-pr-123.example.com \
#   X402_PRIVATE_KEY=0x… \
#   AGENT_READY_MIN=70 \
#   examples/agent-readiness-ci.sh
#
# Exits non-zero when the Agent Readiness score is below AGENT_READY_MIN.
#
# COST: ~$0.075 USDC per run (one quick-depth audit; settles only on success).
#
# PREVIEW_URL must be publicly reachable — the audit runs on Santos
# infrastructure and cannot see localhost, private IPs, or previews behind
# authentication.
#
# X402_PRIVATE_KEY is an EVM private key for a wallet holding USDC on Base
# mainnet (eip155:8453). Use a DEDICATED spending wallet funded with a few
# dollars of USDC on Base (buy/send via Coinbase, or bridge) — never a
# treasury or personal key.
#
# The payment step needs an x402 v2 client. This script uses the official
# TypeScript client (@x402/fetch + @x402/evm, installed into a temp dir); any
# x402 v2 client works — e.g. the Python x402 package, or a raw curl flow:
# request once, base64-decode the PAYMENT-REQUIRED header, sign the quoted
# EIP-3009 transferWithAuthorization yourself, and retry with a
# PAYMENT-SIGNATURE header. See https://www.santosautomation.com/docs.

set -euo pipefail

: "${PREVIEW_URL:?Set PREVIEW_URL to your publicly reachable preview URL}"
: "${X402_PRIVATE_KEY:?Set X402_PRIVATE_KEY (EVM key with USDC on Base)}"
AGENT_READY_MIN="${AGENT_READY_MIN:-70}"

command -v node >/dev/null || { echo "node 22+ is required" >&2; exit 1; }
command -v npm  >/dev/null || { echo "npm is required" >&2; exit 1; }

# Install the x402 client into a throwaway dir so the repo stays clean.
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
npm install --prefix "$WORKDIR" --no-save --silent @x402/fetch @x402/evm viem

cat > "$WORKDIR/check.mjs" <<'EOF'
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

const account = privateKeyToAccount(process.env.X402_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const min = Number(process.env.AGENT_READY_MIN || "70");
const endpoint =
  "https://api.santosautomation.com/api/agent-readiness?url=" +
  encodeURIComponent(process.env.PREVIEW_URL) + "&depth=quick";

// Unpaid, this endpoint returns 402 PAYMENT-REQUIRED; fetchWithPay signs the
// quoted ~$0.075 USDC terms and retries automatically.
const res = await fetchWithPay(endpoint);
if (!res.ok) {
  console.error(`Audit failed: HTTP ${res.status}`, await res.text());
  process.exit(1);
}
const report = await res.json();
console.log(`Agent Readiness: score ${report.score}/100, grade ${report.grade}, level ${report.readiness_level?.name}`);
if (typeof report.score !== "number" || report.score < min) {
  console.error(`Score ${report.score} is below the required minimum of ${min}.`);
  process.exit(1);
}
console.log(`Score ${report.score} >= ${min} — gate passed.`);
EOF

# ESM resolves bare imports by walking up from the script's directory, so the
# temp dir's node_modules is found automatically (NODE_PATH is CommonJS-only).
node "$WORKDIR/check.mjs"
