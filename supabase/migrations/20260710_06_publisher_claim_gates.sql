-- Re-check launch gates inside the claim RPC so a misconfigured worker
-- cannot pull ready rows when auto-publish is OFF, kill-switch is STOP,
-- dry-runs are incomplete, or the daily limit is already reached.
create or replace function public.mc_claim_publications(
  p_worker text,
  p_limit int,
  p_now timestamptz
) returns setof public.mc_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publisher_enabled boolean := false;
  v_publisher_mode text := 'dry_run';
  v_kill_switch boolean := true;
  v_daily_limit int := 2;
  v_published_today int := 0;
  v_remaining int := 0;
begin
  select coalesce((value #>> '{}')::boolean, false)
    into v_publisher_enabled
  from public.mc_system_settings
  where key = 'publisher_enabled';

  select coalesce(value #>> '{}', 'dry_run')
    into v_publisher_mode
  from public.mc_system_settings
  where key = 'publisher_mode';

  select coalesce((value #>> '{}')::boolean, true)
    into v_kill_switch
  from public.mc_system_settings
  where key = 'kill_switch';

  select greatest(0, coalesce((value #>> '{}')::int, 2))
    into v_daily_limit
  from public.mc_system_settings
  where key = 'daily_publish_limit';

  if not v_publisher_enabled
     or v_publisher_mode <> 'live'
     or v_kill_switch then
    return;
  end if;

  select count(*)::int
    into v_published_today
  from public.mc_publications
  where status = 'published'
    and published_at >= date_trunc('day', p_now at time zone 'utc');

  v_remaining := greatest(0, v_daily_limit - coalesce(v_published_today, 0));
  if v_remaining = 0 then
    return;
  end if;

  return query
  with candidates as (
    select p.id
    from public.mc_publications p
    join public.mc_drafts d on d.id = p.draft_id
    where p.status = 'ready'
      and p.scheduled_for <= p_now
      and p.dry_run_count >= 3
      and d.status = 'scheduled'
      and d.approved_at is not null
      and coalesce(p.x_post_id, '') = ''
      and (p.claimed_at is null or p.claimed_at < p_now - interval '10 minutes')
    order by p.scheduled_for
    for update of p skip locked
    limit greatest(1, least(p_limit, v_remaining, 5))
  )
  update public.mc_publications p
  set status = 'publishing',
      claimed_by = p_worker,
      claimed_at = p_now,
      attempt_count = p.attempt_count + 1,
      updated_at = p_now
  from candidates c
  where p.id = c.id
  returning p.*;
end;
$$;

revoke all on function public.mc_claim_publications(text, int, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_claim_publications(text, int, timestamptz) to service_role;
