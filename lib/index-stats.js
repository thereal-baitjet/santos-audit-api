// Santos Index statistics — the single source of truth for public claims
// about the audited-site index ("300+ sites", average/median scores).
//
// Values are computed from the real seed data (scripts/seed-results.jsonl,
// 307 audited domains: average 59.2, median 58, max 91) and match what the
// live leaderboard computes from the public_reports table. Pages that can
// query the live store (the leaderboard) do; static marketing surfaces use
// these constants so the same claim is never hardcoded in two places.

export const INDEX_STATS = {
  edition: "July 2026",
  auditedSiteCount: 307,
  // Public label for the count claim — conservative on purpose ("300+").
  auditedSiteCountLabel: "300+",
  averageScore: 59,
  medianScore: 58,
  topScore: 91,
  topDomain: "planetscale.com",
  examples: [
    { domain: "google.com", score: 39 },
    { domain: "oracle.com", score: 39 },
    { domain: "binance.com", score: 24 },
    { domain: "planetscale.com", score: 91 },
  ],
};
