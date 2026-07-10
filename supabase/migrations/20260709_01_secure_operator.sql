-- Solvers Agency OS — private operator auth
-- Telegram OTP bootstrap + WebAuthn passkeys

create table if not exists public.mc_auth_challenges (
  id uuid primary key,
  kind text not null check (kind in ('telegram_otp','passkey_register','passkey_login')),
  code_hash text,
  challenge text,
  attempts int not null default 0 check (attempts >= 0 and attempts <= 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mc_auth_challenges_ip_created_idx
  on public.mc_auth_challenges(ip_hash, created_at desc);
create index if not exists mc_auth_challenges_kind_created_idx
  on public.mc_auth_challenges(kind, created_at desc);

create table if not exists public.mc_passkeys (
  id uuid primary key default gen_random_uuid(),
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.mc_sessions (
  id uuid primary key,
  factor text not null check (factor in ('telegram_otp','passkey')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists mc_sessions_expires_idx
  on public.mc_sessions(expires_at);

create table if not exists public.mc_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'operator',
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mc_auth_challenges enable row level security;
alter table public.mc_passkeys enable row level security;
alter table public.mc_sessions enable row level security;
alter table public.mc_events enable row level security;

-- Remove v1.4 demo/public policies. Next.js and Hermes use service role server-side.
drop policy if exists mc_status_read on public.mc_status;
drop policy if exists mc_areas_read on public.mc_areas;
drop policy if exists mc_drafts_read on public.mc_drafts;
drop policy if exists mc_weekly_read on public.mc_weekly_items;
drop policy if exists mc_signals_read on public.mc_signals;
drop policy if exists mc_metrics_read on public.mc_metrics;
drop policy if exists mc_schedule_read on public.mc_schedule;
drop policy if exists mc_automations_read on public.mc_automations;
drop policy if exists mc_pipeline_read on public.mc_pipeline;
drop policy if exists mc_calendar_read on public.mc_calendar_days;
drop policy if exists mc_drafts_update on public.mc_drafts;
drop policy if exists mc_automations_update on public.mc_automations;

create or replace function public.mc_consume_otp(
  p_id uuid,
  p_code_hash text,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matched boolean := false;
begin
  update public.mc_auth_challenges
  set
    attempts = attempts + 1,
    consumed_at = case when code_hash = p_code_hash then p_now else consumed_at end
  where id = p_id
    and kind = 'telegram_otp'
    and consumed_at is null
    and attempts < 5
    and expires_at > p_now
  returning (code_hash = p_code_hash) into matched;

  return coalesce(matched, false);
end;
$$;

revoke all on function public.mc_consume_otp(uuid, text, timestamptz) from public;
revoke all on function public.mc_consume_otp(uuid, text, timestamptz) from anon;
revoke all on function public.mc_consume_otp(uuid, text, timestamptz) from authenticated;
grant execute on function public.mc_consume_otp(uuid, text, timestamptz) to service_role;
