// Durable store for Santos Monitoring (weekly re-audit subscriptions) and its
// run history — monitoring_subscriptions / monitoring_runs from migration 010.
// Postgres when DATABASE_URL is set (production), in-memory fallback for local
// dev/tests. Same least-privilege connection pattern as lib/stripe/store.js.
import { randomUUID } from "node:crypto";

import { pgPool as pg, hasDatabase } from "../pg.js";

const mem = new Map(); // id -> subscription row (fallback)
const memRuns = []; // fallback monitoring_runs rows

// Insert a subscription the first time a Stripe subscription id is seen.
// Returns the row when THIS call inserted it, null when the stripe
// subscription id already existed (webhook replay) — the idempotency gate.
export async function insertSubscription({ email, targetUrl, stripeCustomerId, stripeSubscriptionId }) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `INSERT INTO monitoring_subscriptions (email, target_url, stripe_customer_id, stripe_subscription_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (stripe_subscription_id) DO NOTHING RETURNING *`,
      [email, targetUrl, stripeCustomerId ?? null, stripeSubscriptionId ?? null]
    );
    return rows[0] ?? null;
  }
  if (stripeSubscriptionId && [...mem.values()].some((row) => row.stripe_subscription_id === stripeSubscriptionId)) return null;
  const row = {
    id: randomUUID(),
    email,
    target_url: targetUrl,
    stripe_customer_id: stripeCustomerId ?? null,
    stripe_subscription_id: stripeSubscriptionId ?? null,
    status: "active",
    last_score: null,
    last_digest_at: null,
    last_run_at: null,
    created_at: new Date().toISOString(),
    canceled_at: null,
  };
  mem.set(row.id, row);
  return { ...row };
}

export async function getSubscriptionByStripeId(stripeSubscriptionId) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT * FROM monitoring_subscriptions WHERE stripe_subscription_id = $1`,
      [stripeSubscriptionId]
    );
    return rows[0] ?? null;
  }
  return [...mem.values()].find((row) => row.stripe_subscription_id === stripeSubscriptionId) ?? null;
}

export async function getSubscriptionById(id) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(`SELECT * FROM monitoring_subscriptions WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
  const row = mem.get(id);
  return row ? { ...row } : null;
}

// Active subscriptions whose weekly re-audit is due (never run, or last run
// older than 7 days), oldest first with never-run subscriptions ahead.
export async function listDueSubscriptions(limit = 50) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT * FROM monitoring_subscriptions
       WHERE status = 'active'
         AND (last_run_at IS NULL OR last_run_at < now() - interval '7 days')
       ORDER BY last_run_at ASC NULLS FIRST
       LIMIT $1`,
      [limit]
    );
    return rows;
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return [...mem.values()]
    .filter((row) => row.status === "active" && (!row.last_run_at || new Date(row.last_run_at).getTime() < weekAgo))
    .sort((a, b) => (a.last_run_at ? new Date(a.last_run_at).getTime() : 0) - (b.last_run_at ? new Date(b.last_run_at).getTime() : 0))
    .slice(0, limit)
    .map((row) => ({ ...row }));
}

export async function insertRun({ subscriptionId, score, report }) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `INSERT INTO monitoring_runs (subscription_id, score, report) VALUES ($1, $2, $3) RETURNING id`,
      [subscriptionId, score ?? null, report ?? null]
    );
    return rows[0] ?? null;
  }
  const row = { id: memRuns.length + 1, subscription_id: subscriptionId, score: score ?? null, report: report ?? null, created_at: new Date().toISOString() };
  memRuns.push(row);
  return { id: row.id };
}

// Post-run bookkeeping: always record the new score and run time; when a
// digest was sent for this run, stamp last_digest_at too.
export async function updateScoreAndRun({ id, score, digestSent = false }) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(
      `UPDATE monitoring_subscriptions
       SET last_score = $2, last_run_at = now(),
           last_digest_at = CASE WHEN $3 THEN now() ELSE last_digest_at END
       WHERE id = $1`,
      [id, score ?? null, digestSent]
    );
    return;
  }
  const row = mem.get(id);
  if (row) Object.assign(row, {
    last_score: score ?? null,
    last_run_at: new Date().toISOString(),
    ...(digestSent ? { last_digest_at: new Date().toISOString() } : {}),
  });
}

// Stripe customer.subscription.deleted: keyed on the Stripe subscription id.
// Returns the updated row (or null when unknown) so callers can log context.
export async function markCanceled(stripeSubscriptionId) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE monitoring_subscriptions SET status = 'canceled', canceled_at = now()
       WHERE stripe_subscription_id = $1 RETURNING *`,
      [stripeSubscriptionId]
    );
    return rows[0] ?? null;
  }
  const row = [...mem.values()].find((r) => r.stripe_subscription_id === stripeSubscriptionId);
  if (row) Object.assign(row, { status: "canceled", canceled_at: new Date().toISOString() });
  return row ? { ...row } : null;
}

// Stripe invoice.payment_failed: pause alerting until the card goes through.
export async function markPastDue(stripeSubscriptionId) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE monitoring_subscriptions SET status = 'past_due'
       WHERE stripe_subscription_id = $1 RETURNING *`,
      [stripeSubscriptionId]
    );
    return rows[0] ?? null;
  }
  const row = [...mem.values()].find((r) => r.stripe_subscription_id === stripeSubscriptionId);
  if (row) Object.assign(row, { status: "past_due" });
  return row ? { ...row } : null;
}

// Self-serve unsubscribe from the manage page: keyed on the internal id (the
// HMAC manage token payload). Only an active/past_due row is transitioned.
export async function cancelById(id) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `UPDATE monitoring_subscriptions SET status = 'canceled', canceled_at = now()
       WHERE id = $1 AND status IN ('active', 'past_due') RETURNING *`,
      [id]
    );
    return rows[0] ?? null;
  }
  const row = mem.get(id);
  if (row && (row.status === "active" || row.status === "past_due")) {
    Object.assign(row, { status: "canceled", canceled_at: new Date().toISOString() });
    return { ...row };
  }
  return null;
}
