-- 008_demo_leads.sql — email capture for exhausted free demos.
-- One row per signup: a human who hit the shared 1/day/IP demo quota and asked
-- for tomorrow's free audit to be emailed. Capture only — nothing is sent yet.
create table if not exists public.demo_leads (
  id         bigint generated always as identity primary key,
  email      text not null,
  target_url text not null,
  source     text not null default 'audit-widget',
  created_at timestamptz not null default now()
);

create index if not exists demo_leads_created_at_idx on public.demo_leads (created_at desc);

-- Same least-privilege posture as the other tables: RLS on (blocks the
-- Supabase anon/authenticated API roles); the worker roles write and read.
alter table public.demo_leads enable row level security;

create policy worker_all on public.demo_leads
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

grant select, insert on public.demo_leads to santos_worker, santos_worker_local, santos_worker_fly;
