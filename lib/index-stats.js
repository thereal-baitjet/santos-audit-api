// Santos Index statistics — the single source of truth for public claims
// about the audited-site index ("300+ sites", average/median scores).
//
// Values are computed from the real seed data (scripts/seed-results.jsonl,
// October 2026 re-run: 309 audited domains, average 62.5, median 62, max 92)
// and match what the live leaderboard computes from the public_reports table
// once the run is inserted. The July 2026 edition (307 domains, average 59.2,
// median 58) was scored with an alt-text rule that failed alt="" decorative
// images; the October re-run uses the corrected rule. Pages that can
// query the live store (the leaderboard) do; static marketing surfaces use
// these constants so the same claim is never hardcoded in two places.

export const INDEX_STATS = {
  edition: "October 2026",
  auditedSiteCount: 309,
  // Public label for the count claim — conservative on purpose ("300+").
  auditedSiteCountLabel: "300+",
  averageScore: 63,
  medianScore: 62,
  topScore: 92,
  topDomain: "cloudflare.com",
  examples: [
    { domain: "google.com", score: 39 },
    { domain: "oracle.com", score: 46 },
    { domain: "binance.com", score: 24 },
    { domain: "cloudflare.com", score: 92 },
  ],
};
