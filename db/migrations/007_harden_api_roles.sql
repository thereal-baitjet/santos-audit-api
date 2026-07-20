-- 007_harden_api_roles.sql — security hardening (applied 2026-07-20 via MCP).
--
-- 1) Defense in depth for the Supabase API roles. RLS already blocked
--    anon/authenticated on every table, but both roles held blanket table
--    privileges (including TRUNCATE, which RLS does not govern). Revoke
--    everything, then re-grant only what the admin dashboard needs:
--    authenticated SELECT on agent_logs (RLS admin_read still applies on top).

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.agent_logs to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 2) Block open signups at the database level: only allowlisted operator
--    emails may be inserted into auth.users. Stranger signups get a clean
--    error before a user record ever exists.

create or replace function public.restrict_auth_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) not in ('baitjet@gmail.com', 'info@santosautomation.com') then
    raise exception 'signups are restricted to authorized operators';
  end if;
  return new;
end
$$;

-- Not callable through PostgREST RPC (advisor lint 0028/0029).
revoke execute on function public.restrict_auth_signups() from public, anon, authenticated;

drop trigger if exists restrict_auth_signups on auth.users;
create trigger restrict_auth_signups
  before insert on auth.users
  for each row execute function public.restrict_auth_signups();

-- 3) Retention: cap agent_logs growth at 90 days (nightly at 03:17 UTC).

create extension if not exists pg_cron;
select cron.schedule('agent-logs-retention', '17 3 * * *',
  $$delete from public.agent_logs where created_at < now() - interval '90 days'$$);
