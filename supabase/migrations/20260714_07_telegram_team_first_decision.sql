-- Telegram team decisions: first valid approve/decline wins atomically.

create or replace function public.mc_register_telegram_approval_message(
  p_draft_id uuid,
  p_chat_id text,
  p_message_id bigint,
  p_now timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_draft public.mc_drafts%rowtype;
  current_metadata jsonb;
  current_messages jsonb;
  next_messages jsonb;
begin
  if p_chat_id !~ '^\d{5,20}$' or p_message_id is null or p_message_id <= 0 then
    raise exception 'invalid_telegram_message';
  end if;

  select * into selected_draft
  from public.mc_drafts
  where id = p_draft_id
  for update;
  if selected_draft.id is null then raise exception 'draft_not_found'; end if;
  current_metadata := selected_draft.metadata;

  current_messages := case
    when jsonb_typeof(current_metadata->'telegram_approval_messages') = 'array'
      then current_metadata->'telegram_approval_messages'
    else '[]'::jsonb
  end;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into next_messages
  from jsonb_array_elements(current_messages) item
  where item->>'chat_id' <> p_chat_id;

  next_messages := next_messages || jsonb_build_array(jsonb_build_object(
    'chat_id', p_chat_id,
    'message_id', p_message_id,
    'sent_at', p_now
  ));

  update public.mc_drafts
  set metadata = jsonb_set(
    coalesce(current_metadata, '{}'::jsonb),
    '{telegram_approval_messages}',
    next_messages,
    true
  ),
  updated_at = p_now
  where id = p_draft_id;

  return jsonb_build_object(
    'ok', true,
    'messages', next_messages,
    'decision', case
      when selected_draft.status in ('scheduled', 'publishing', 'published', 'failed') then 'approve'
      when selected_draft.status = 'rejected' then 'decline'
      else null
    end,
    'scheduled_for', selected_draft.scheduled_for,
    'decided_by', current_metadata->>'telegram_decided_by'
  );
end;
$$;

revoke all on function public.mc_register_telegram_approval_message(uuid, text, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_register_telegram_approval_message(uuid, text, bigint, timestamptz) to service_role;

create or replace function public.mc_decide_draft_telegram(
  p_draft_id uuid,
  p_expected_version int,
  p_action text,
  p_scheduled_for timestamptz,
  p_content_hash text,
  p_idempotency_key text,
  p_actor text,
  p_now timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_draft public.mc_drafts%rowtype;
  publication public.mc_publications%rowtype;
  next_metadata jsonb;
begin
  if p_action not in ('approve', 'decline') then
    raise exception 'invalid_decision';
  end if;
  if coalesce(trim(p_actor), '') = '' then
    raise exception 'actor_required';
  end if;

  select * into selected_draft
  from public.mc_drafts
  where id = p_draft_id
  for update;
  if selected_draft.id is null then raise exception 'draft_not_found'; end if;

  if selected_draft.status in ('scheduled', 'publishing', 'published', 'failed') then
    return jsonb_build_object(
      'applied', false,
      'decision', 'approve',
      'draft_status', selected_draft.status,
      'draft_id', selected_draft.id
    );
  end if;
  if selected_draft.status = 'rejected' then
    return jsonb_build_object(
      'applied', false,
      'decision', 'decline',
      'draft_status', selected_draft.status,
      'draft_id', selected_draft.id
    );
  end if;
  if selected_draft.version <> p_expected_version then
    raise exception 'version_conflict';
  end if;
  if selected_draft.status <> 'in_review' then
    raise exception 'draft_not_in_review';
  end if;
  if coalesce(trim(selected_draft.body), '') = '' then raise exception 'body_required'; end if;

  next_metadata := coalesce(selected_draft.metadata, '{}'::jsonb) || jsonb_build_object(
    'telegram_decision', p_action,
    'telegram_decided_at', p_now,
    'telegram_decided_by', left(p_actor, 120)
  );

  if p_action = 'decline' then
    update public.mc_drafts
    set status = 'rejected',
        version = version + 1,
        metadata = next_metadata,
        updated_at = p_now
    where id = selected_draft.id;

    insert into public.mc_events(actor, event_type, entity_type, entity_id, payload)
    values (
      left(p_actor, 120),
      'factory.draft_declined_telegram',
      'draft',
      selected_draft.id::text,
      jsonb_build_object('channel', 'solvers_notifications', 'decision', 'decline')
    );

    return jsonb_build_object(
      'applied', true,
      'decision', 'decline',
      'draft_status', 'rejected',
      'draft_id', selected_draft.id
    );
  end if;

  if p_scheduled_for is null or p_scheduled_for <= p_now then
    raise exception 'future_schedule_required';
  end if;
  if coalesce(trim(p_content_hash), '') = '' or coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'publication_intent_required';
  end if;

  update public.mc_drafts
  set status = 'approved',
      approved_at = p_now,
      approved_by = left(p_actor, 120),
      version = version + 1,
      metadata = next_metadata,
      updated_at = p_now
  where id = selected_draft.id;

  insert into public.mc_publications (
    draft_id, draft_version, status, scheduled_for, content_snapshot,
    content_hash, idempotency_key
  ) values (
    selected_draft.id, selected_draft.version + 1, 'queued', p_scheduled_for,
    selected_draft.body, p_content_hash, p_idempotency_key
  )
  returning * into publication;

  update public.mc_drafts
  set status = 'scheduled',
      scheduled_for = p_scheduled_for,
      version = version + 1,
      updated_at = p_now
  where id = selected_draft.id;

  insert into public.mc_events(actor, event_type, entity_type, entity_id, payload)
  values (
    left(p_actor, 120),
    'factory.draft_approved_telegram',
    'draft',
    selected_draft.id::text,
    jsonb_build_object(
      'channel', 'solvers_notifications',
      'decision', 'approve',
      'publication_id', publication.id,
      'scheduled_for', p_scheduled_for
    )
  );

  return jsonb_build_object(
    'applied', true,
    'decision', 'approve',
    'draft_status', 'scheduled',
    'draft_id', selected_draft.id,
    'publication_id', publication.id,
    'scheduled_for', publication.scheduled_for
  );
end;
$$;

revoke all on function public.mc_decide_draft_telegram(uuid, int, text, timestamptz, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_decide_draft_telegram(uuid, int, text, timestamptz, text, text, text, timestamptz) to service_role;
