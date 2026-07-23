"use client";

import { useState } from "react";

// Copy-to-clipboard button for the workflow code block. Falls back to
// selecting the text when the Clipboard API is unavailable.
export default function CopyButton({ text, label = "Copy workflow" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
