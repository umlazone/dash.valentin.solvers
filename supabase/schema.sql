-- Solvers Mission Control — live schema v1.4
-- Project: violetaAI

create extension if not exists "pgcrypto";

create table if not exists public.mc_status (
  id text primary key default 'default',
  handle text not null,
  phase text,
  objective_90d text,
  language_policy text,
  auto_post boolean default false,
  plan text,
  bio text,
  updated_at timestamptz default now()
);

create table if not exists public.mc_areas (
  id text primary key,
  code text not null,
  name text not null,
  description text,
  priority text check (priority in ('core','growth','support','side')),
  weekly_target int not null default 1,
  done_this_week int not null default 0
);

create table if not exists public.mc_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  area text,
  status text not null default 'pending'
    check (status in ('pending','approved','posted','rejected')),
  language text default 'ES',
  preview text,
  body text,
  source text,
  score int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mc_weekly_items (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  day_label text,
  item text not null,
  state text,
  created_at timestamptz default now()
);

create table if not exists public.mc_signals (
  id uuid primary key default gen_random_uuid(),
  creator_handle text,
  mechanism text,
  solvers_angle text,
  raw_ref text,
  created_at timestamptz default now()
);

create table if not exists public.mc_metrics (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  followers int,
  following int,
  tweets int,
  likes int,
  posts_7d int,
  replies_7d int,
  impressions_7d int,
  engagements_7d int,
  profile_visits_7d int,
  dm_or_qualified_replies int,
  leads_high_ticket int,
  spark_followers jsonb default '[]'::jsonb,
  spark_engagement jsonb default '[]'::jsonb,
  spark_posts jsonb default '[]'::jsonb,
  raw jsonb default '{}'::jsonb
);

create table if not exists public.mc_schedule (
  id text primary key,
  when_label text not null,
  title text not null,
  status text not null default 'planned',
  channel text not null default 'X post',
  scheduled_for timestamptz,
  draft_id uuid references public.mc_drafts(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mc_automations (
  id text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  cadence text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_pipeline (
  id text primary key,
  label text not null,
  count int not null default 0,
  tone text not null default 'neutral',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_calendar_days (
  id text primary key,
  day_label text not null,
  posts int not null default 0,
  replies int not null default 0,
  focus text,
  sort_order int not null default 0
);

-- Private operator authentication
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

create table if not exists public.mc_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'operator',
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS: no anon/browser policies. Protected Next.js APIs and Hermes use service role.
alter table public.mc_status enable row level security;
alter table public.mc_areas enable row level security;
alter table public.mc_drafts enable row level security;
alter table public.mc_weekly_items enable row level security;
alter table public.mc_signals enable row level security;
alter table public.mc_metrics enable row level security;
alter table public.mc_schedule enable row level security;
alter table public.mc_automations enable row level security;
alter table public.mc_pipeline enable row level security;
alter table public.mc_calendar_days enable row level security;
alter table public.mc_auth_challenges enable row level security;
alter table public.mc_passkeys enable row level security;
alter table public.mc_sessions enable row level security;
alter table public.mc_events enable row level security;

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

create or replace function public.mc_consume_webauthn_challenge(
  p_id uuid,
  p_kind text,
  p_now timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found_challenge text;
  found_metadata jsonb;
begin
  update public.mc_auth_challenges
  set consumed_at = p_now
  where id = p_id
    and kind = p_kind
    and kind in ('passkey_register','passkey_login')
    and consumed_at is null
    and expires_at > p_now
  returning challenge, metadata into found_challenge, found_metadata;
  if found_challenge is null then return null; end if;
  return jsonb_build_object(
    'challenge', found_challenge,
    'metadata', coalesce(found_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.mc_consume_webauthn_challenge(uuid, text, timestamptz) from public;
revoke all on function public.mc_consume_webauthn_challenge(uuid, text, timestamptz) from anon;
revoke all on function public.mc_consume_webauthn_challenge(uuid, text, timestamptz) from authenticated;
grant execute on function public.mc_consume_webauthn_challenge(uuid, text, timestamptz) to service_role;
