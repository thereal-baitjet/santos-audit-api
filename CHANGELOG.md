# Changelog

## 2.2.2 — 2026-07-18

- Make the standalone Agent Readiness service paid by default at $0.025 USDC per
  successful audit through x402 v2 on Base mainnet.
- Publish one validated price across the route, website, OpenAPI, JSON-LD, service
  and capability manifests, MCP, llms.txt, terms, and operator documentation.
- Close the free MCP execution bypass: `audit_agent_readiness` now validates input
  and returns the canonical paid HTTP handoff. The embedded Quick Audit object remains
  an explicitly lower-coverage preview.

## 2.2.1 — 2026-07-18

- Add resource-scoped Agent Readiness pricing analysis across public text, JSON-LD
  Offers, vendor capability manifests, and passive x402 v2 challenges.
- Normalize enforced USDC atomic amounts, report pricing evidence under
  `interfaces.pricing`, and fail consistency checks when public metadata contradicts
  live payment terms without treating distinct product tiers as conflicts.

## 2.2.0 — 2026-07-18

- Add versioned Agent Readiness analyzer, standalone endpoint, MCP tool, capability
  manifest, additive Quick Audit result, and opt-in Deep Page Audit module.
- Add applicability-aware scoring, strict passive-probe limits, public documentation,
  examples, and contract tests.
