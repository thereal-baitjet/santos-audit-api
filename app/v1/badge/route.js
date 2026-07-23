import { withAgentLog } from "../../../lib/agent-log.js";
// GET /v1/badge?url=… (or ?domain=…) — the embeddable Agent-Ready shield.
// Reads the opt-in public_reports listing; three states:
//   fresh (audited ≤ 30 days ago)  → gold shield, score, verification date
//   stale (audited > 30 days ago)  → muted, prompts a re-verify
//   unknown domain                 → gray "unverified"
// Free, no quota — it's an image. Cached at the edge for an hour; stale
// states age out on their own as created_at crosses the 30-day line.
import { NextResponse } from "next/server";
import { CORS } from "../../../lib/errors.js";
import { getPublicReport } from "../../../lib/public-reports.js";

const GOLD = "#d4a24e";
const INK = "#14110b";
const PAPER = "#ece5d3";
const MUTED = "#8f8775";
const GRAY = "#6e6e6e";
const BG = "#171410";

const STALE_AFTER_MS = 30 * 24 * 3600 * 1000;
const CHAR_W = 6.6; // 11px ui-monospace advance width

const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function scoreOf(row) {
  if (Number.isFinite(row?.score)) return row.score;
  const report = row?.report ?? {};
  const score = report.website_intelligence_score ?? report.overall_score ?? report.score;
  return Number.isFinite(score) ? score : null;
}

// Shield glyph, ~12×14 inside a translate().
const SHIELD_PATH = "M6 0 L12 2.2 V6.2 C12 10 9.5 12.6 6 13.8 C2.5 12.6 0 10 0 6.2 V2.2 Z";

function badgeSvg({ label, score, color, showShield }) {
  const labelX = showShield ? 30 : 12;
  const scoreW = score == null ? 0 : 26;
  const width = Math.ceil(labelX + label.length * CHAR_W + (score == null ? 12 : scoreW + 10));
  const shield = showShield
    ? `<path d="${SHIELD_PATH}" transform="translate(9 7)" fill="${color}"/>`
    : "";
  const scoreText =
    score == null
      ? ""
      : `<text x="${width - 10}" y="18.5" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" font-weight="700" fill="${color}">${escapeXml(score)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${escapeXml(label)}${score == null ? "" : ` ${score}`}">
<rect x="0.5" y="0.5" width="${width - 1}" height="27" rx="4" fill="${BG}" stroke="${color}"/>
${shield}
<text x="${labelX}" y="18.5" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="${PAPER}">${escapeXml(label)}</text>
${scoreText}
</svg>`;
}

function svgResponse(svg) {
  return new NextResponse(svg, {
    headers: {
      ...CORS,
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function handleGET(req) {
  const target = req.nextUrl.searchParams.get("url") ?? req.nextUrl.searchParams.get("domain") ?? "";

  // Lookup failures (and unknown domains) render the gray unverified badge —
  // an embed should never 500 into someone's README.
  const row = target ? await getPublicReport(target).catch(() => null) : null;

  if (!row) {
    return svgResponse(badgeSvg({ label: "agent-readiness unverified", score: null, color: GRAY, showShield: true }));
  }

  const score = scoreOf(row);
  const auditedAt = new Date(row.created_at);
  const date = Number.isNaN(auditedAt.getTime()) ? "unknown-date" : auditedAt.toISOString().slice(0, 10);

  if (Date.now() - auditedAt.getTime() > STALE_AFTER_MS) {
    return svgResponse(
      badgeSvg({ label: `score ${score ?? "?"} · re-verify`, score: null, color: MUTED, showShield: true })
    );
  }

  return svgResponse(
    badgeSvg({ label: `Agent-Ready · verified ${date}`, score: score ?? "—", color: GOLD, showShield: true })
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export const GET = withAgentLog(handleGET, "badge");
