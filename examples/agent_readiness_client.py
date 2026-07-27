"""Agent Readiness is a PAID endpoint: $0.075 USDC via x402 v2 on Base mainnet.

This dependency-free script demonstrates the unauthenticated 402-challenge
response: it calls the endpoint without payment, decodes the PAYMENT-REQUIRED
header, and prints the quoted x402 terms (amount, asset, payTo, network).

To actually buy an audit, use an x402 v2-capable client that signs the quoted
terms and retries with a PAYMENT-SIGNATURE header — see buy-readiness.js in
this repo for a verified JS buyer flow, or the `x402` PyPI package.
"""
import base64
import json
import urllib.error
import urllib.parse
import urllib.request

target = "https://example.com"
url = "https://api.santosautomation.com/api/agent-readiness?" + urllib.parse.urlencode({"url": target, "depth": "quick"})

try:
    with urllib.request.urlopen(url, timeout=30) as response:
        report = json.load(response)
    print(report["score"], report["grade"], report["readiness_level"])
except urllib.error.HTTPError as exc:
    if exc.code != 402:
        raise
    header = exc.headers.get("PAYMENT-REQUIRED")
    terms = json.loads(base64.b64decode(header)) if header else {}
    print(f"402 Payment Required — x402 v{terms.get('x402Version')} terms:")
    print(json.dumps(terms.get("accepts", terms), indent=2))
    print("\nSign these terms with an x402 v2 client (see buy-readiness.js) and retry with PAYMENT-SIGNATURE.")
