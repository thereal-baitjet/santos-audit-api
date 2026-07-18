# Agent Readiness scoring

`AgentReadinessResult` schema version `1.0.0` uses six category weights:

| Category | Weight |
|---|---:|
| Discovery and documentation | 20 |
| Structured identity and context | 15 |
| API readiness | 20 |
| MCP readiness | 25 |
| Operational trust | 10 |
| Agent commerce | 10 |

The analyzer first classifies the target as a general website, documentation site,
API provider, MCP provider, or agent-commerce provider. API, MCP, and commerce
categories become `not_applicable` unless public evidence advertises them. Their
weight is removed from the denominator rather than scored as zero.

Within applicable categories, passed check weight divided by tested check weight
produces the subscore. Unknown evidence is never counted as a pass. The report also
publishes `tested_coverage_percent` and confidence so a high score with limited
coverage cannot masquerade as comprehensive proof.

Grades are A (90–100), B (80–89), C (70–79), D (60–69), and F (below 60).
Readiness levels are 0 Human-only, 1 LLM-readable, 2 Machine-described, 3
Tool-invokable, and 4 Transaction-ready. Levels depend on observed interfaces, not
the numeric score alone.

## Pricing and agent-commerce logic

When machine commerce is applicable, `interfaces.pricing` reports normalized pricing
claims from public page text, `llms.txt`, Schema.org `Offer` data, capability
manifests, and a live unpaid x402 challenge. The challenge is read without a
`PAYMENT-SIGNATURE`; the analyzer never signs or transfers funds.

Pricing comparisons are scoped to the canonical paid-resource path. Prices for two
different capabilities are therefore allowed to differ. For the same resource, a
contradiction in amount, currency, or network fails `agent.commerce.discovery` and
`agent.metadata.consistency`. A complete result also requires a price, currency or
asset, network, billing unit, and canonical paid resource. USDC x402 atomic amounts
are normalized with six decimals when the asset can be identified as USDC, while the
original atomic amount remains in evidence.

The embedded Quick Audit uses the page already fetched and makes zero additional
requests. Its Agent Readiness coverage is therefore intentionally lower. The
historical Quick Audit `overall_score` remains the mean of performance, SEO,
accessibility, and security and is not changed by this module.
