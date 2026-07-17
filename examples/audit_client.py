"""Santos Site Audit API — Python client examples.

Free demo (no payment, 1/day per IP): plain HTTP.
Paid tier ($0.005 USDC via x402): use the `x402` PyPI package with a funded
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
    """Paid audit via x402. Requires: pip install x402 eth-account
    and BUYER_PRIVATE_KEY set to a Base-mainnet wallet holding USDC."""
    from eth_account import Account          # pip install eth-account
    from x402.clients.requests import x402_requests  # pip install x402

    account = Account.from_key(os.environ["BUYER_PRIVATE_KEY"])
    session = x402_requests(account)
    qs = urllib.parse.urlencode({"url": url})
    res = session.get(f"{BASE}/api/audit?{qs}")
    res.raise_for_status()
    return res.json()


if __name__ == "__main__":
    report = demo_audit("example.com")
    print(f"overall {report['overall_score']} | scores {report['scores']}")
    for issue in report["issues"]:
        print(f"  fix: {issue}")
