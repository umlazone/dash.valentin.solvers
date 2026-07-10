-- Solvers Agency OS auth hardening
-- Atomic rate limits, recent one-use enrollment grants, counter CAS, revocation.

create table if not exists public.mc_enrollment_grants (
  id uuid primary key,
  session_id uuid not null references public.mc_sessions(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mc_enrollment_grants_session_idx
  on public.mc_enrollment_grants(session_id, expires_at desc);

alter table public.mc_enrollment_grants enable row level security;
revoke all on table public.mc_enrollment_grants from anon;
revoke all on table public.mc_enrollment_grants from authenticated;
grant all on table public.mc_enrollment_grants to service_role;

-- Be explicit instead of relying on the original demo schema.
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

create or replace function public.mc_reserve_otp_challenge(
  p_id uuid,
  p_code_hash text,
  p_ip_hash text,
  p_expires_at timestamptz,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 32 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('otp:' || p_ip_hash, 0));

  delete from public.mc_auth_challenges
  where expires_at < p_now - interval '1 day';
  delete from public.mc_enrollment_grants
  where expires_at < p_now - interval '1 day';
  delete from public.mc_sessions
  where expires_at < p_now - interval '1 day';

  select count(*) into recent_count
  from public.mc_auth_challenges
  where kind = 'telegram_otp'
    and ip_hash = p_ip_hash
    and created_at >= p_now - interval '10 minutes';

  if recent_count >= 3 then
    return false;
  end if;

  if exists (
    select 1 from public.mc_auth_challenges
    where kind = 'telegram_otp'
      and ip_hash = p_ip_hash
      and created_at >= p_now - interval '30 seconds'
  ) then
    return false;
  end if;

  insert into public.mc_auth_challenges (
    id, kind, code_hash, ip_hash, expires_at, created_at
  ) values (
    p_id, 'telegram_otp', p_code_hash, p_ip_hash, p_expires_at, p_now
  );
  return true;
end;
$$;

create or replace function public.mc_create_otp_session_with_grant(
  p_session_id uuid,
  p_session_expires_at timestamptz,
  p_grant_id uuid,
  p_grant_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_grant_expires_at > p_session_expires_at then
    return false;
  end if;

  insert into public.mc_sessions (id, factor, expires_at)
  values (p_session_id, 'telegram_otp', p_session_expires_at);

  insert into public.mc_enrollment_grants (id, session_id, expires_at)
  values (p_grant_id, p_session_id, p_grant_expires_at);

  return true;
end;
$$;

create or replace function public.mc_store_passkey_with_grant(
  p_grant_id uuid,
  p_session_id uuid,
  p_credential_id text,
  p_public_key text,
  p_counter bigint,
  p_transports text[],
  p_device_type text,
  p_backed_up boolean,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('passkey-enrollment', 0));

  if (select count(*) from public.mc_passkeys) >= 5 then
    return false;
  end if;

  update public.mc_enrollment_grants
  set consumed_at = p_now
  where id = p_grant_id
    and session_id = p_session_id
    and consumed_at is null
    and expires_at > p_now;

  if not found then
    return false;
  end if;

  insert into public.mc_passkeys (
    credential_id, public_key, counter, transports, device_type, backed_up
  ) values (
    p_credential_id, p_public_key, p_counter,
    coalesce(p_transports, '{}'::text[]), p_device_type, p_backed_up
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.mc_reserve_webauthn_login_challenge(
  p_id uuid,
  p_challenge text,
  p_ip_hash text,
  p_expires_at timestamptz,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 32 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('webauthn:' || p_ip_hash, 0));

  delete from public.mc_auth_challenges
  where expires_at < p_now - interval '1 day';

  select count(*) into recent_count
  from public.mc_auth_challenges
  where kind = 'passkey_login'
    and ip_hash = p_ip_hash
    and created_at >= p_now - interval '10 minutes';

  if recent_count >= 10 then
    return false;
  end if;

  insert into public.mc_auth_challenges (
    id, kind, challenge, ip_hash, expires_at, created_at
  ) values (
    p_id, 'passkey_login', p_challenge, p_ip_hash, p_expires_at, p_now
  );
  return true;
end;
$$;

create or replace function public.mc_update_passkey_counter(
  p_credential_id text,
  p_old_counter bigint,
  p_new_counter bigint,
  p_device_type text,
  p_backed_up boolean,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mc_passkeys
  set counter = p_new_counter,
      device_type = p_device_type,
      backed_up = p_backed_up,
      last_used_at = p_now
  where credential_id = p_credential_id
    and counter = p_old_counter
    and (
      (p_old_counter = 0 and p_new_counter = 0)
      or p_new_counter > p_old_counter
    );
  return found;
end;
$$;

create or replace function public.mc_revoke_session(
  p_id uuid,
  p_now timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mc_sessions
  set revoked_at = p_now
  where id = p_id
    and revoked_at is null
    and expires_at > p_now;
  return found;
end;
$$;

revoke all on function public.mc_reserve_otp_challenge(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_reserve_otp_challenge(uuid, text, text, timestamptz, timestamptz) to service_role;
revoke all on function public.mc_create_otp_session_with_grant(uuid, timestamptz, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_create_otp_session_with_grant(uuid, timestamptz, uuid, timestamptz) to service_role;
revoke all on function public.mc_store_passkey_with_grant(uuid, uuid, text, text, bigint, text[], text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_store_passkey_with_grant(uuid, uuid, text, text, bigint, text[], text, boolean, timestamptz) to service_role;
revoke all on function public.mc_reserve_webauthn_login_challenge(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_reserve_webauthn_login_challenge(uuid, text, text, timestamptz, timestamptz) to service_role;
revoke all on function public.mc_update_passkey_counter(text, bigint, bigint, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_update_passkey_counter(text, bigint, bigint, text, boolean, timestamptz) to service_role;
revoke all on function public.mc_revoke_session(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_revoke_session(uuid, timestamptz) to service_role;

-- Remove abandoned pre-hardening challenges; active sessions remain valid but have no grant.
delete from public.mc_auth_challenges
where consumed_at is not null or expires_at <= now();
