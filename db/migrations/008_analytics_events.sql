-- 008_analytics_events.sql — durable sink for first-party funnel analytics.
-- Backs app/api/analytics/route.js (client beacons) and the Stripe webhook's
-- server-side payment_completed, both writing via lib/analytics-store.js.
--
-- Privacy by design: whitelisted event name + coarse scalar props only. No
-- URLs, report contents, wallet data, or payment signatures; the client IP is
-- stored HMAC-hashed (same scheme as lib/demo-limit.js).

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null,
  props jsonb not null default '{}'::jsonb,
  client_ts timestamptz,
  ip_hash text,
  user_agent text
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

create policy worker_all on public.analytics_events
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

grant select, insert on public.analytics_events to santos_worker, santos_worker_local, santos_worker_fly;
