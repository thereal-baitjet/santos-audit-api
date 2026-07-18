"""Minimal Agent Readiness client. The endpoint is free unless deployment pricing is configured."""
import json
import urllib.parse
import urllib.request

target = "https://example.com"
url = "https://api.santosautomation.com/api/agent-readiness?" + urllib.parse.urlencode({"url": target, "depth": "quick"})

with urllib.request.urlopen(url, timeout=30) as response:
    report = json.load(response)

print(report["score"], report["grade"], report["readiness_level"])
for action in report["recommended_actions"][:5]:
    print("-", action.get("title", action))
