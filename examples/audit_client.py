"""Santos Site Audit API — Python client examples.

Free demo (no payment, 1/day per IP): plain HTTP.
Paid tier ($0.015 USDC via x402): use the `x402` PyPI package with a funded
Base-mainnet wallet; it handles the 402 -> sign -> retry flow automatically.
"""

import os
import urllib.parse
import urllib.request
import json

BASE = os.environ.get("SANTOS_AUDIT_BASE", "https://api.santosautomation.com")


def demo_audit(url: str) -> dict:
    """Free demo audit — same report shape as the paid tier."""
    qs = urllib.parse.urlencode({"url": url})
    with urllib.request.urlopen(f"{BASE}/api/audit/demo?{qs}", timeout=30) as res:
        return json.load(res)


def paid_audit(url: str) -> dict:
    """Paid audit via x402 v2 ($0.015 USDC on Base mainnet).

    The paid endpoint speaks x402 v2 (PAYMENT-REQUIRED / PAYMENT-SIGNATURE
    headers). Use an x402 v2-capable client; check the x402 PyPI package's
    current version for v2 support, or shell out to the JS client
    (buy-live.js in this repo) which is verified against this API.
    """
    raise NotImplementedError(
        "Use an x402 v2-capable client (see buy-live.js for a working JS example)."
    )


if __name__ == "__main__":
    report = demo_audit("example.com")
    print(f"overall {report['overall_score']} | scores {report['scores']}")
    for issue in report["issues"]:
        print(f"  fix: {issue}")
