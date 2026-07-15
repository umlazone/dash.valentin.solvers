-- Bind Telegram proposal controls to an exact draft version and reserve active schedule slots.

create unique index if not exists mc_publications_active_scheduled_for_uidx
  on public.mc_publications(scheduled_for)
  where status in ('queued','validating','ready','publishing');

drop function if exists public.mc_register_telegram_approval_message(uuid, text, bigint, timestamptz);

create or replace function public.mc_register_telegram_approval_message(
  p_draft_id uuid,
  p_draft_version int,
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
  canonical_decision text;
begin
  if p_draft_version is null or p_draft_version < 1 then
    raise exception 'invalid_draft_version';
  end if;
  if p_chat_id !~ '^\d{5,20}$' or p_message_id is null or p_message_id <= 0 then
    raise exception 'invalid_telegram_message';
  end if;

  select * into selected_draft
  from public.mc_drafts
  where id = p_draft_id
  for update;
  if selected_draft.id is null then raise exception 'draft_not_found'; end if;

  current_metadata := coalesce(selected_draft.metadata, '{}'::jsonb);
  canonical_decision := case
    when selected_draft.status in ('scheduled', 'publishing', 'published', 'failed') then 'approve'
    when selected_draft.status = 'rejected' then 'decline'
    else null
  end;

  if selected_draft.version <> p_draft_version then
    return jsonb_build_object(
      'ok', true,
      'registered', false,
      'stale', true,
      'current_version', selected_draft.version,
      'draft_status', selected_draft.status,
      'decision', canonical_decision,
      'scheduled_for', selected_draft.scheduled_for,
      'decided_by', current_metadata->>'telegram_decided_by'
    );
  end if;

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
    'draft_version', p_draft_version,
    'sent_at', p_now
  ));

  update public.mc_drafts
  set metadata = jsonb_set(
    current_metadata,
    '{telegram_approval_messages}',
    next_messages,
    true
  ),
  updated_at = p_now
  where id = p_draft_id;

  return jsonb_build_object(
    'ok', true,
    'registered', true,
    'stale', false,
    'messages', next_messages,
    'draft_status', selected_draft.status,
    'decision', canonical_decision,
    'scheduled_for', selected_draft.scheduled_for,
    'decided_by', current_metadata->>'telegram_decided_by'
  );
end;
$$;

revoke all on function public.mc_register_telegram_approval_message(uuid, int, text, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.mc_register_telegram_approval_message(uuid, int, text, bigint, timestamptz) to service_role;
