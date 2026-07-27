-- 010_tiers_and_monitoring.sql — tiered human card reports ($9 quick / $29
-- deep) and the monitoring-subscription tables (schema only; the monitoring
-- product ships in a later phase).

-- stripe_purchases gains the purchased tier (drives webhook fulfilment) and,
-- for deep purchases, the audit job the purchase is waiting on (the cron
-- deep-tier sweep reads status='processing' rows and emails on completion).
alter table public.stripe_purchases
  add column if not exists tier text not null default 'quick',
  add column if not exists job_id text;

create index if not exists stripe_purchases_processing_idx
  on public.stripe_purchases (status) where status = 'processing';

-- Monitoring subscriptions (later phase): one row per card-managed recurring
-- watch of a target URL. stripe_subscription_id is the idempotency key.
create table if not exists public.monitoring_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null,
  target_url             text not null,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'active',
  last_score             integer,
  last_digest_at         timestamptz,
  last_run_at            timestamptz,
  created_at             timestamptz not null default now(),
  canceled_at            timestamptz
);

-- One row per scheduled monitoring run of a subscription.
create table if not exists public.monitoring_runs (
  id              bigint generated always as identity primary key,
  subscription_id uuid not null references public.monitoring_subscriptions(id) on delete cascade,
  score           integer,
  report          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists monitoring_runs_subscription_idx
  on public.monitoring_runs (subscription_id, created_at desc);

-- Same least-privilege posture as the other tables: RLS on (blocks the
-- Supabase anon/authenticated API roles); the worker roles write and read.
alter table public.monitoring_subscriptions enable row level security;
alter table public.monitoring_runs enable row level security;

create policy worker_all on public.monitoring_subscriptions
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

create policy worker_all on public.monitoring_runs
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

grant select, insert, update, delete on public.monitoring_subscriptions to santos_worker, santos_worker_local, santos_worker_fly;
grant select, insert, update, delete on public.monitoring_runs to santos_worker, santos_worker_local, santos_worker_fly;
-- Inserts into monitoring_runs need the identity sequence.
grant usage, select on sequence public.monitoring_runs_id_seq to santos_worker, santos_worker_local, santos_worker_fly;
