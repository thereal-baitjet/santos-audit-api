-- 006_agent_logs.sql — AI-agent traffic log + admin dashboard access.
-- Applied to Supabase project santos-audit-deep on 2026-07-20 via MCP.
--
-- Writers: the santos_worker* Postgres roles (same blanket-policy pattern as
-- the other tables; Supabase API roles get no write path).
-- Readers: Supabase Auth users on the hardcoded admin email allowlist, via the
-- authenticated role — this is what the /admin/dashboard realtime view uses.

create table public.agent_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  agent_name text,
  user_agent text,
  method text not null default 'GET',
  path text not null,
  status smallint,
  ip_hash text,
  country text,
  referer text,
  meta jsonb not null default '{}'::jsonb
);

create index agent_logs_created_at_idx on public.agent_logs (created_at desc);

alter table public.agent_logs enable row level security;

create policy worker_all on public.agent_logs
  for all to santos_worker, santos_worker_local, santos_worker_fly
  using (true) with check (true);

create policy admin_read on public.agent_logs
  for select to authenticated
  using ((select auth.jwt() ->> 'email') in ('baitjet@gmail.com', 'info@santosautomation.com'));

grant select, insert on public.agent_logs to santos_worker, santos_worker_local, santos_worker_fly;
grant select on public.agent_logs to authenticated;

-- Live INSERT events for the dashboard; delivery respects the RLS policy above.
alter publication supabase_realtime add table public.agent_logs;
