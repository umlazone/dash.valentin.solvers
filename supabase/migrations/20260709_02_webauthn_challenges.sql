-- Atomic one-time consumption for WebAuthn registration/login challenges
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

  if found_challenge is null then
    return null;
  end if;

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
