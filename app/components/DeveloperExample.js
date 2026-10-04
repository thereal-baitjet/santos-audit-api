"use client";

import { useEffect, useState } from "react";
import { Tabs } from "./ui/Tabs.js";
import { Check, Copy } from "lucide-react";

const examples = {
  javascript: `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";\nimport { ExactEvmScheme } from "@x402/evm";\nimport { privateKeyToAccount } from "viem/accounts";\n\n// Server-side only: a funded wallet on Base is required.\nconst account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);\nconst paidFetch = wrapFetchWithPaymentFromConfig(fetch, {\n  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],\n});\n\nconst response = await paidFetch(\n  "https://api.santosautomation.com/api/audit?url=example.com"\n);\nif (!response.ok) throw new Error(\`Audit failed: \${response.status}\`);\nconst report = await response.json();`,
  curl: `# Inspect the payment terms. This does not purchase an audit.\ncurl -i "https://api.santosautomation.com/api/audit?url=example.com"\n\n# Response: 402 Payment Required\n# PAYMENT-REQUIRED contains the x402 terms.\n# An x402 v2 client signs and retries with PAYMENT-SIGNATURE.\n# Payment settles on a successful response.`,
  mcp: `// Add this remote MCP endpoint to your client:\n{\n  "mcpServers": {\n    "santos": {\n      "url": "https://api.santosautomation.com/mcp"\n    }\n  }\n}\n\n// Paid tools return an x402 payment handoff.\n// Complete the handoff with a funded x402 client.`,
};

export default function DeveloperExample() {
  const [language, setLanguage] = useState("javascript");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2500);
    return () => clearTimeout(timer);
  }, [message]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(examples[language]);
      setMessage("Copied");
    } catch {
      setMessage("Select the code to copy");
    }
  }
  return (
    <Tabs.Root
      className="developer-example"
      value={language}
      onValueChange={(value) => {
        setLanguage(value);
        setMessage("");
      }}
    >
      <div className="developer-toolbar">
        <Tabs.List aria-label="Integration language">
          <Tabs.Trigger value="javascript">JavaScript</Tabs.Trigger>
          <Tabs.Trigger value="curl">cURL</Tabs.Trigger>
          <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
        </Tabs.List>
        <button type="button" onClick={copy} aria-label="Copy integration code">
          {message === "Copied" ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Copy size={15} aria-hidden="true" />
          )}
          <span>{message || "Copy"}</span>
        </button>
      </div>
      {Object.entries(examples).map(([key, code]) => (
        <Tabs.Content value={key} key={key}>
          <pre tabIndex={0}>
            <code>
              {code.split("\n").map((line, i) => (
                <span
                  className={
                    line.trim().startsWith("//") || line.trim().startsWith("#")
                      ? "code-comment"
                      : "code-line"
                  }
                  key={i}
                >
                  <i aria-hidden="true">{String(i + 1).padStart(2, "0")}</i>
                  {line || " "}
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        </Tabs.Content>
      ))}
      <div className="developer-code-footer">
        <span>●</span> x402 v2 <span className="code-footer-separator">/</span>{" "}
        USDC on Base <a href="/docs">Read the docs ↗</a>
      </div>
      <span className="sr-only" role="status">
        {message}
      </span>
    </Tabs.Root>
  );
}
