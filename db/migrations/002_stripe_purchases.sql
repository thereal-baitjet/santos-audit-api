-- Stripe card-purchase path for the human $19 Agent Readiness Report.
-- One row per Checkout Session (session_id is the idempotency key). The audit
-- report is stored inline and read via an HMAC bearer token (accessTokenFor).
CREATE TABLE IF NOT EXISTS stripe_purchases (
  session_id    text PRIMARY KEY,              -- Stripe Checkout Session id — idempotency key
  status        text NOT NULL DEFAULT 'pending', -- pending | completed | failed
  payment_rail  text NOT NULL DEFAULT 'stripe',
  target_url    text NOT NULL,
  email         text NOT NULL,
  report_id     text,                          -- rpt_… (tokened report URL)
  report        jsonb,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS stripe_purchases_report_idx ON stripe_purchases (report_id);

-- Same least-privilege posture as the deep-audit tables: RLS on (blocks the
-- Supabase anon/authenticated API roles); our own service role gets full access.
ALTER TABLE stripe_purchases ENABLE ROW LEVEL SECURITY;
