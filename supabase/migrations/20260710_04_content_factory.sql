-- Solvers Agency OS — content factory v2
-- Capture -> research -> draft -> review -> schedule -> dry-run -> publish -> learn

create table if not exists public.mc_captures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  raw_text text not null,
  capture_type text not null default 'note'
    check (capture_type in ('case','roadblock','win','close','tool','playbook','question','voice_note','note')),
  source_type text not null default 'operator'
    check (source_type in ('operator','telegram','voice','meeting','client','x','system')),
  source_ref text,
  language text not null default 'ES' check (language in ('ES','EN')),
  area text,
  tags text[] not null default '{}',
  priority int not null default 50 check (priority between 0 and 100),
  status text not null default 'new'
    check (status in ('new','triaged','drafted','archived')),
  created_by text not null default 'operator',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_research_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'x_grok' check (run_type in ('x_grok','manual','metrics')),
  mode text not null default 'recurring' check (mode in ('recurring','manual','backfill')),
  status text not null default 'running' check (status in ('running','completed','partial','failed')),
  model text,
  source_window jsonb not null default '{}'::jsonb,
  query_count int not null default 0,
  signal_count int not null default 0,
  summary text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.mc_signals
  add column if not exists fingerprint text,
  add column if not exists research_run_id uuid references public.mc_research_runs(id) on delete set null,
  add column if not exists source_platform text not null default 'x',
  add column if not exists source_author text,
  add column if not exists source_url text,
  add column if not exists source_post_id text,
  add column if not exists source_text text,
  add column if not exists evidence text,
  add column if not exists content_format text,
  add column if not exists language text not null default 'ES',
  add column if not exists score int not null default 50,
  add column if not exists status text not null default 'new',
  add column if not exists discovered_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.mc_signals drop constraint if exists mc_signals_status_check;
alter table public.mc_signals add constraint mc_signals_status_check
  check (status in ('new','shortlisted','used','dismissed','archived'));
alter table public.mc_signals drop constraint if exists mc_signals_score_check;
alter table public.mc_signals add constraint mc_signals_score_check check (score between 0 and 100);
create unique index if not exists mc_signals_fingerprint_uidx
  on public.mc_signals(fingerprint) where fingerprint is not null;
create index if not exists mc_signals_status_score_idx
  on public.mc_signals(status, score desc, discovered_at desc);

alter table public.mc_drafts drop constraint if exists mc_drafts_status_check;
update public.mc_drafts set status = case status
  when 'pending' then 'in_review'
  when 'posted' then 'published'
  else status
end;
alter table public.mc_drafts alter column status set default 'draft';
alter table public.mc_drafts
  add column if not exists capture_id uuid references public.mc_captures(id) on delete set null,
  add column if not exists signal_id uuid references public.mc_signals(id) on delete set null,
  add column if not exists content_type text not null default 'post',
  add column if not exists hook text,
  add column if not exists cta text,
  add column if not exists change_request text,
  add column if not exists version int not null default 1,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists x_post_id text,
  add column if not exists quality_checks jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.mc_drafts add constraint mc_drafts_status_check
  check (status in ('draft','in_review','changes_requested','approved','scheduled','publishing','published','failed','rejected','archived','cancelled'));
alter table public.mc_drafts drop constraint if exists mc_drafts_content_type_check;
alter table public.mc_drafts add constraint mc_drafts_content_type_check
  check (content_type in ('post','thread','reply','quote','case','playbook','question'));
create index if not exists mc_drafts_status_updated_idx
  on public.mc_drafts(status, updated_at desc);
create unique index if not exists mc_drafts_source_fingerprint_uidx
  on public.mc_drafts((metadata->>'source_fingerprint'))
  where metadata ? 'source_fingerprint';

create table if not exists public.mc_draft_revisions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.mc_drafts(id) on delete cascade,
  version int not null,
  title text not null,
  body text not null,
  change_request text,
  author text not null default 'operator',
  created_at timestamptz not null default now(),
  unique(draft_id, version)
);

create table if not exists public.mc_publications (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.mc_drafts(id) on delete restrict,
  draft_version int not null,
  channel text not null default 'x' check (channel in ('x')),
  status text not null default 'queued'
    check (status in ('queued','validating','ready','publishing','published','failed','cancelled')),
  scheduled_for timestamptz not null,
  content_snapshot text not null,
  content_hash text not null,
  idempotency_key text not null unique,
  dry_run_count int not null default 0 check (dry_run_count between 0 and 10),
  attempt_count int not null default 0 check (attempt_count between 0 and 10),
  claimed_by text,
  claimed_at timestamptz,
  x_post_id text unique,
  error text,
  validation jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, draft_version)
);
create index if not exists mc_publications_queue_idx
  on public.mc_publications(status, scheduled_for);

create table if not exists public.mc_post_metrics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.mc_publications(id) on delete cascade,
  window_label text not null check (window_label in ('live','24h','72h','7d')),
  captured_at timestamptz not null default now(),
  impressions int,
  likes int,
  replies int,
  reposts int,
  quotes int,
  bookmarks int,
  profile_clicks int,
  url_clicks int,
  raw jsonb not null default '{}'::jsonb,
  unique(publication_id, window_label)
);

create table if not exists public.mc_system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.mc_system_settings(key, value, description) values
  ('research_enabled', 'true'::jsonb, 'Grok/X research loop enabled'),
  ('research_cadence_hours', '4'::jsonb, 'Hours between recurring research runs'),
  ('publisher_mode', '"dry_run"'::jsonb, 'dry_run or live'),
  ('publisher_enabled', 'false'::jsonb, 'Master gate for actual X publishing'),
  ('kill_switch', 'false'::jsonb, 'Stops publisher immediately when true'),
  ('daily_publish_limit', '2'::jsonb, 'Maximum X posts per UTC day'),
  ('approval_required', 'true'::jsonb, 'Every publication requires explicit human approval')
on conflict (key) do nothing;

create or replace function public.mc_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mc_captures_touch on public.mc_captures;
create trigger mc_captures_touch before update on public.mc_captures
for each row execute function public.mc_touch_updated_at();
drop trigger if exists mc_signals_touch on public.mc_signals;
create trigger mc_signals_touch before update on public.mc_signals
for each row execute function public.mc_touch_updated_at();
drop trigger if exists mc_drafts_touch on public.mc_drafts;
create trigger mc_drafts_touch before update on public.mc_drafts
for each row execute function public.mc_touch_updated_at();
drop trigger if exists mc_publications_touch on public.mc_publications;
create trigger mc_publications_touch before update on public.mc_publications
for each row execute function public.mc_touch_updated_at();

alter table public.mc_captures enable row level security;
alter table public.mc_research_runs enable row level security;
alter table public.mc_signals enable row level security;
alter table public.mc_drafts enable row level security;
alter table public.mc_draft_revisions enable row level security;
alter table public.mc_publications enable row level security;
alter table public.mc_post_metrics enable row level security;
alter table public.mc_system_settings enable row level security;

revoke all on table public.mc_captures from anon, authenticated;
revoke all on table public.mc_research_runs from anon, authenticated;
revoke all on table public.mc_signals from anon, authenticated;
revoke all on table public.mc_drafts from anon, authenticated;
revoke all on table public.mc_draft_revisions from anon, authenticated;
revoke all on table public.mc_publications from anon, authenticated;
revoke all on table public.mc_post_metrics from anon, authenticated;
revoke all on table public.mc_system_settings from anon, authenticated;
grant all on table public.mc_captures to service_role;
grant all on table public.mc_research_runs to service_role;
grant all on table public.mc_signals to service_role;
grant all on table public.mc_drafts to service_role;
grant all on table public.mc_draft_revisions to service_role;
grant all on table public.mc_publications to service_role;
grant all on table public.mc_post_metrics to service_role;
grant all on table public.mc_system_settings to service_role;

-- Atomic schedule: approved draft + immutable snapshot + idempotent queue row.
create or replace function public.mc_schedule_draft(
  p_draft_id uuid,
  p_expected_version int,
  p_scheduled_for timestamptz,
  p_content_hash text,
  p_idempotency_key text,
  p_now timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_draft public.mc_drafts%rowtype;
  publication public.mc_publications%rowtype;
begin
  select * into selected_draft
  from public.mc_drafts
  where id = p_draft_id
  for update;

  if selected_draft.id is null then raise exception 'draft_not_found'; end if;
  if selected_draft.version <> p_expected_version then raise exception 'version_conflict'; end if;
  if selected_draft.status <> 'approved' or selected_draft.approved_at is null then
    raise exception 'human_approval_required';
  end if;
  if coalesce(trim(selected_draft.body), '') = '' then raise exception 'body_required'; end if;
  if p_scheduled_for <= p_now then raise exception 'future_schedule_required'; end if;

  insert into public.mc_publications (
    draft_id, draft_version, status, scheduled_for, content_snapshot,
    content_hash, idempotency_key
  ) values (
    selected_draft.id, selected_draft.version, 'queued', p_scheduled_for,
    selected_draft.body, p_content_hash, p_idempotency_key
  )
  on conflict (idempotency_key) do update
    set scheduled_for = excluded.scheduled_for,
        updated_at = p_now
  returning * into publication;

  update public.mc_drafts
  set status = 'scheduled',
      scheduled_for = p_scheduled_for,
      version = version + 1,
      updated_at = p_now
  where id = selected_draft.id;

  insert into public.mc_events(actor, event_type, entity_type, entity_id, payload)
  values ('operator', 'factory.draft_scheduled', 'draft', selected_draft.id::text,
    jsonb_build_object('publication_id', publication.id, 'scheduled_for', p_scheduled_for));

  return jsonb_build_object(
    'publication_id', publication.id,
    'draft_id', selected_draft.id,
    'scheduled_for', publication.scheduled_for,
    'status', publication.status
  );
end;
$$;

revoke all on function public.mc_schedule_draft(uuid, int, timestamptz, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_schedule_draft(uuid, int, timestamptz, text, text, timestamptz) to service_role;

-- Atomic claim: one worker can own a due, approved, ready publication.
create or replace function public.mc_claim_publications(
  p_worker text,
  p_limit int,
  p_now timestamptz
) returns setof public.mc_publications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select p.id
    from public.mc_publications p
    join public.mc_drafts d on d.id = p.draft_id
    where p.status = 'ready'
      and p.scheduled_for <= p_now
      and d.status = 'scheduled'
      and d.approved_at is not null
      and (p.claimed_at is null or p.claimed_at < p_now - interval '10 minutes')
    order by p.scheduled_for
    for update of p skip locked
    limit greatest(1, least(p_limit, 5))
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
