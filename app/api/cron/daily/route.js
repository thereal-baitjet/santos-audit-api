// GET /api/cron/daily — Vercel Cron entry point (vercel.json: 17 11 * * * UTC).
// Guarded by CRON_SECRET (Vercel sends `Authorization: Bearer <secret>`); set
// the env var in every deployed environment — see .env.example.
//
// Two bounded jobs per tick, each isolated so one failing never kills the other:
//   1. Deep-tier fulfillment sweep — stripe_purchases with tier='deep' and
//      status='processing' (batch 25). Reads the audit job via the deep store;
//      on completion emails the buyer a tokened report link and completes the
//      purchase; on a terminally failed job marks the purchase failed.
//   2. Weekly monitoring re-audit — active monitoring_subscriptions due for
//      their 7-day re-audit (batch 50, oldest/never-run first). Runs the same
//      quick agent-readiness audit in-process, records a monitoring_runs row,
//      and emails a regression alert (|Δ| >= 5) or monthly digest (28 days).
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { listProcessingDeepPurchases, completePurchase, failPurchase } from "../../../../lib/stripe/store.js";
import { getStore } from "../../../../lib/deep/store.js";
import { newReportId, accessTokenFor } from "../../../../lib/deep/ids.js";
import { sendReportEmail, sendRegressionAlertEmail, sendMonitoringDigestEmail } from "../../../../lib/email/resend.js";
import { averagePublicScore } from "../../../../lib/public-reports.js";
import { auditAgentReadiness } from "../../../../lib/agent-readiness/analyze.js";
import { listDueSubscriptions, insertRun, updateScoreAndRun } from "../../../../lib/monitoring/store.js";
import { decideMonitoringAction, topIssuesFromReport } from "../../../../lib/monitoring/decide.js";
import { monitoringTokenFor } from "../../../../lib/monitoring/tokens.js";
import { recordEvent } from "../../../../lib/analytics-store.js";

const NO_STORE = { "Cache-Control": "no-store" };
const DEEP_SWEEP_BATCH = 25;
const MONITORING_BATCH = 50;

function siteOrigin() {
  return process.env.PUBLIC_SITE_URL || "https://www.santosautomation.com";
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Job 1: fulfil deep-tier card purchases whose worker job has finished.
async function sweepDeepPurchases() {
  const pending = await listProcessingDeepPurchases(DEEP_SWEEP_BATCH);
  const summary = { scanned: pending.length, completed: 0, failed: 0, waiting: 0 };
  const store = getStore();

  for (const purchase of pending) {
    try {
      const job = purchase.job_id ? await store.getJob(purchase.job_id) : null;
      if (!job) {
        summary.waiting++; // job row not visible yet — try again next tick
        continue;
      }
      if (job.status === "completed") {
        const report = await store.getReport(job.id);
        if (!report) {
          summary.waiting++; // completed but report not readable yet
          continue;
        }
        const reportId = newReportId();
        // Same tokened URL shape the webhook's quick path builds.
        const reportUrl = `${siteOrigin()}/agent-readiness/report/${reportId}?token=${accessTokenFor(reportId)}`;
        // Index average is a nice-to-have stat line; never block fulfilment.
        const indexAverage = await averagePublicScore().catch(() => null);
        const score = report?.website_intelligence_score ?? report?.overall_score ?? report?.score ?? null;
        const mail = await sendReportEmail({
          to: purchase.email, reportUrl, targetUrl: purchase.target_url, tier: "deep", score, indexAverage,
        });
        if (!mail.ok) console.error("Deep report email not sent:", mail.reason, "(report is still retrievable at its URL)");
        await completePurchase(purchase.session_id, reportId, report, job.id);
        await recordEvent({ event: "deep_report_completed", props: { tier: "deep" } });
        summary.completed++;
      } else if (job.status === "failed" || job.status === "cancelled" || job.status === "expired") {
        await failPurchase(purchase.session_id, job.error_message ?? `job ${job.status}`);
        summary.failed++;
      } else {
        summary.waiting++; // queued/running — check again next tick
      }
    } catch (e) {
      // One bad purchase must not strand the rest of the batch.
      console.error(`Deep sweep failed for ${purchase.session_id}:`, e.message);
    }
  }
  return summary;
}

// Job 2: weekly re-audit of active monitoring subscriptions.
async function runMonitoringAudits() {
  const due = await listDueSubscriptions(MONITORING_BATCH);
  const summary = { scanned: due.length, audited: 0, alerts: 0, digests: 0, errors: 0 };

  for (const sub of due) {
    try {
      const result = await auditAgentReadiness(sub.target_url, { mode: "quick" });
      const newScore = result.score;
      await insertRun({ subscriptionId: sub.id, score: newScore, report: result });

      const manageUrl = `${siteOrigin()}/monitoring/manage?t=${monitoringTokenFor(sub.id)}`;
      const action = decideMonitoringAction({
        lastScore: sub.last_score, newScore, lastDigestAt: sub.last_digest_at, now: new Date(),
      });
      if (action === "alert") {
        const mail = await sendRegressionAlertEmail({
          to: sub.email, targetUrl: sub.target_url,
          oldScore: sub.last_score, newScore,
          topIssues: topIssuesFromReport(result),
          manageUrl,
        });
        if (!mail.ok) console.error("Regression alert email not sent:", mail.reason);
        await recordEvent({ event: "regression_alert_sent", props: { delta: Math.abs(newScore - sub.last_score) } });
        summary.alerts++;
      } else if (action === "digest") {
        const mail = await sendMonitoringDigestEmail({ to: sub.email, targetUrl: sub.target_url, score: newScore, manageUrl });
        if (!mail.ok) console.error("Monitoring digest email not sent:", mail.reason);
        summary.digests++;
      }
      await updateScoreAndRun({ id: sub.id, score: newScore, digestSent: action === "digest" });
      summary.audited++;
    } catch (e) {
      // Log and continue — one unauditable target never fails the batch.
      console.error(`Monitoring run failed for subscription ${sub.id} (${sub.target_url}):`, e.message);
      summary.errors++;
    }
  }
  return summary;
}

export async function GET(req) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
  }

  const [deep, monitoring] = await Promise.allSettled([sweepDeepPurchases(), runMonitoringAudits()]);
  if (deep.status === "rejected") console.error("Deep-tier sweep crashed:", deep.reason?.message ?? deep.reason);
  if (monitoring.status === "rejected") console.error("Monitoring re-audit crashed:", monitoring.reason?.message ?? monitoring.reason);

  return NextResponse.json({
    ok: deep.status === "fulfilled" && monitoring.status === "fulfilled",
    deep: deep.status === "fulfilled" ? deep.value : { error: String(deep.reason?.message ?? deep.reason) },
    monitoring: monitoring.status === "fulfilled" ? monitoring.value : { error: String(monitoring.reason?.message ?? monitoring.reason) },
  }, { headers: NO_STORE });
}
