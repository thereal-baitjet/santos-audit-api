-- 009_verified_leads.sql — email verification for the widget free audit, plus
-- the public_reports table (written by the opt-in "list my score publicly"
-- flow; one row per domain, latest report wins via upsert).

-- demo_leads gains verification state: the sha256 hash of the 6-digit code we
-- emailed, its 10-minute expiry, and when the address was confirmed.
alter table public.demo_leads
  add column if not exists verified_at timestamptz,
  add column if not exists verify_code_hash text,
  add column if not exists verify_expires_at timestamptz;

create table if not exists public.public_reports (
  domain     text primary key,
  url        text not null,
  score      int,
  report     jsonb not null,
  source     text not null,
  created_at timestamptz not null default now()
);

-- Leaderboard ordering: highest scores first.
create index if not exists public_reports_score_idx on public.public_reports (score desc);

-- Same least-privilege posture as the other tables: RLS on (blocks the
-- Supabase anon/authenticated API roles); the worker roles write and read.
alter table public.public_reports enable row level security;

create policy worker_all on public.public_reports
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

-- Upsert on the domain PK needs update/delete in addition to select/insert.
grant select, insert, update, delete on public.public_reports to santos_worker, santos_worker_local, santos_worker_fly;

-- demo_leads already has select/insert (008); verification now sets
-- verified_at / verify_code_hash on existing rows, so the workers need update.
grant update on public.demo_leads to santos_worker, santos_worker_local, santos_worker_fly;
