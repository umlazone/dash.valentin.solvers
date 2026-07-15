import { NextRequest, NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import {
  formatProposalMessage,
  parseApprovalCallback,
  selectNextWeeklyContentSlot,
} from "@/lib/telegram/approval";
import { buildPublicationIntent } from "@/lib/factory/workflow";
import {
  answerCallback,
  editProposalResult,
  sendTextMessage,
} from "@/lib/telegram/bot";
import {
  buildPendingNotificationMember,
  formatTeamAccessRequest,
  formatTeamStatus,
  formatTelegramDecisionLine,
  isActiveNotificationMember,
  isPrivateTelegramIdentity,
  isValidOperatorCallbackIdentity,
  normalizeNotificationMember,
  normalizeTelegramApprovalMessages,
  notificationMemberKey,
  parseNotificationCommand,
  startOfBogotaDay,
  type NotificationMember,
} from "@/lib/telegram/members";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    message_id?: number;
    text?: string;
    from?: { id?: number; first_name?: string; username?: string };
    chat?: { id?: number | string; type?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number };
    message?: {
      message_id?: number;
      chat?: { id?: number | string; type?: string };
      text?: string;
    };
  };
};

type ServiceClient = NonNullable<ReturnType<typeof getSupabaseService>>;
const PUBLICATION_QUEUE_STATUSES = ["queued", "validating", "ready", "publishing"];

type TelegramDecisionResult = {
  applied: boolean;
  decision: "approve" | "decline";
  draft_status: string;
  scheduled_for?: string;
};

function parseTelegramDecisionResult(value: unknown): TelegramDecisionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_decision_result");
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.applied !== "boolean" ||
    !["approve", "decline"].includes(String(item.decision)) ||
    typeof item.draft_status !== "string"
  ) {
    throw new Error("invalid_decision_result");
  }
  return {
    applied: item.applied,
    decision: item.decision as "approve" | "decline",
    draft_status: item.draft_status,
    ...(typeof item.scheduled_for === "string" ? { scheduled_for: item.scheduled_for } : {}),
  };
}

function formatDecisionTime(value: string | null | undefined) {
  if (!value) return "la próxima franja disponible";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function syncTelegramDecisionMessages(input: {
  sb: ServiceClient;
  botToken: string;
  draftId: string;
  decision: "approve" | "decline";
  fallbackScheduledFor?: string;
  currentChatId: string;
  currentMessageId?: number;
  currentDraftVersion: number;
}) {
  const { data: draft, error } = await input.sb
    .from("mc_drafts")
    .select("id,title,body,language,hook,metadata,scheduled_for")
    .eq("id", input.draftId)
    .maybeSingle();
  if (error || !draft) throw new Error("decision_sync_draft_not_found");
  const originalText = formatProposalMessage({
    title: draft.title,
    body: draft.body,
    language: draft.language === "EN" ? "EN" : "ES",
    angle: draft.hook || undefined,
  });
  const metadata = draft.metadata && typeof draft.metadata === "object" ? draft.metadata as Record<string, unknown> : {};
  const resultLine = formatTelegramDecisionLine({
    decision: input.decision,
    scheduledFor: draft.scheduled_for || input.fallbackScheduledFor,
    actor: metadata.telegram_decided_by,
  });
  const messages = new Map(
    normalizeTelegramApprovalMessages(metadata).map((message) => [message.chatId, message]),
  );
  if (input.currentMessageId) {
    messages.set(input.currentChatId, {
      chatId: input.currentChatId,
      messageId: input.currentMessageId,
      draftVersion: input.currentDraftVersion,
    });
  }
  const failures: Array<{ chatId: string; error: string }> = [];
  for (const message of messages.values()) {
    try {
      await editProposalResult(
        { botToken: input.botToken, chatId: message.chatId },
        message.messageId,
        originalText,
        resultLine,
      );
    } catch (syncError) {
      const detail = syncError instanceof Error ? syncError.message : "telegram_sync_failed";
      if (!detail.includes("message is not modified")) {
        failures.push({ chatId: message.chatId, error: detail.slice(0, 240) });
      }
    }
  }
  if (failures.length) {
    await input.sb.from("mc_events").insert({
      actor: "telegram_sync",
      event_type: "factory.telegram_decision_sync_failed",
      entity_type: "draft",
      entity_id: input.draftId,
      payload: { failures },
    });
  }
  return { synced: messages.size - failures.length, failures: failures.length };
}

async function loadNotificationMember(sb: ServiceClient, chatId: string) {
  const { data, error } = await sb
    .from("mc_system_settings")
    .select("value")
    .eq("key", notificationMemberKey(chatId))
    .maybeSingle();
  if (error) throw new Error(`team_member_lookup_failed:${error.message}`);
  if (!data) return null;
  const member = normalizeNotificationMember(data.value);
  if (!member || member.chatId !== chatId) throw new Error("team_member_state_invalid");
  return member;
}

async function insertPendingNotificationMember(sb: ServiceClient, member: NotificationMember) {
  const { error } = await sb.from("mc_system_settings").insert({
    key: notificationMemberKey(member.chatId),
    value: member,
    description: "Telegram team member with shared Solvers proposal decisions",
    updated_at: new Date().toISOString(),
  });
  if (!error) return { member, inserted: true };
  if (error.code !== "23505") throw new Error(`team_member_insert_failed:${error.message}`);
  const existing = await loadNotificationMember(sb, member.chatId);
  if (!existing) throw new Error("team_member_insert_conflict");
  return { member: existing, inserted: false };
}

async function loadTeamStatus(sb: ServiceClient) {
  const now = new Date();
  const dayStart = startOfBogotaDay(now);
  const [draftsRes, queuedRes, failedRes, publishedRes, nextRes, settingsRes] =
    await Promise.all([
      sb
        .from("mc_drafts")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "in_review", "changes_requested"]),
      sb
        .from("mc_publications")
        .select("id", { count: "exact", head: true })
        .in("status", PUBLICATION_QUEUE_STATUSES),
      sb
        .from("mc_publications")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      sb
        .from("mc_publications")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("published_at", dayStart.toISOString()),
      sb
        .from("mc_publications")
        .select("scheduled_for")
        .in("status", PUBLICATION_QUEUE_STATUSES)
        .gte("scheduled_for", now.toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle(),
      sb
        .from("mc_system_settings")
        .select("key,value")
        .in("key", ["publisher_enabled", "publisher_mode", "kill_switch"]),
    ]);
  const failure = [draftsRes, queuedRes, failedRes, publishedRes, nextRes, settingsRes].find(
    (result) => result.error,
  );
  if (failure?.error) throw new Error(`team_status_failed:${failure.error.message}`);
  const settings = Object.fromEntries(
    (settingsRes.data || []).map((row) => [row.key, row.value]),
  );
  return formatTeamStatus({
    publisherLive:
      settings.publisher_enabled === true &&
      settings.publisher_mode === "live" &&
      settings.kill_switch !== true,
    draftsInReview: Number(draftsRes.count || 0),
    publicationsQueued: Number(queuedRes.count || 0),
    publicationsFailed: Number(failedRes.count || 0),
    publishedToday: Number(publishedRes.count || 0),
    nextScheduledFor: nextRes.data?.scheduled_for || null,
  });
}

async function handleMessage(
  update: NonNullable<TelegramUpdate["message"]>,
  sb: ServiceClient,
  botToken: string,
  operatorChatId: string,
) {
  const chatId = String(update.chat?.id || "");
  const fromId = String(update.from?.id || "");
  const command = parseNotificationCommand(update.text || "");
  if (!chatId || !command) return NextResponse.json({ ok: true, ignored: true });
  if (!isPrivateTelegramIdentity({ chatId, chatType: update.chat?.type, fromId })) {
    return NextResponse.json({ ok: true, ignored: "private_chat_required" });
  }

  if (chatId === operatorChatId) {
    const status = await loadTeamStatus(sb);
    await sendTextMessage(
      { botToken, chatId: operatorChatId },
      `✅ Solvers Notifications está activo.\n\n${status}`,
    );
    return NextResponse.json({ ok: true, command, role: "operator" });
  }

  let member = await loadNotificationMember(sb, chatId);
  if (isActiveNotificationMember(member, chatId)) {
    const status = await loadTeamStatus(sb);
    await sendTextMessage(
      { botToken, chatId },
      command === "start" ? `✅ Acceso de equipo activo.\n\n${status}` : status,
    );
    return NextResponse.json({ ok: true, command, role: "team_decider" });
  }

  if (command === "status") {
    await sendTextMessage(
      { botToken, chatId },
      "Este chat todavía no tiene acceso. Escribe /start para solicitarlo.",
    );
    return NextResponse.json({ ok: true, access: "required" });
  }

  if (member?.status === "rejected") {
    await sendTextMessage(
      { botToken, chatId },
      "Esta solicitud fue rechazada. Habla con Valentin si necesitas que la habilite.",
    );
    return NextResponse.json({ ok: true, access: "rejected" });
  }

  let inserted = false;
  if (!member) {
    const pending = buildPendingNotificationMember({
      chatId,
      fromId,
      firstName: update.from?.first_name,
      username: update.from?.username,
      now: new Date().toISOString(),
    });
    const created = await insertPendingNotificationMember(sb, pending);
    member = created.member;
    inserted = created.inserted;
  }
  if (member.status !== "pending") throw new Error("team_member_state_invalid");

  if (inserted) {
    let operatorDeliveryError: string | null = null;
    try {
      await sendTextMessage(
        { botToken, chatId: operatorChatId },
        formatTeamAccessRequest(member),
      );
    } catch (error) {
      operatorDeliveryError = error instanceof Error ? error.message.slice(0, 300) : "operator_delivery_failed";
    }
    const { error: eventError } = await sb.from("mc_events").insert({
      actor: "telegram_team_member",
      event_type: "factory.telegram_team_access_requested",
      entity_type: "telegram_chat",
      entity_id: member.chatId,
      payload: {
        access: "shared_decisions",
        username: member.username || null,
        operator_delivery_error: operatorDeliveryError,
      },
    });
    if (eventError) throw new Error(`team_event_failed:${eventError.message}`);
  }

  await sendTextMessage(
    { botToken, chatId },
    "Solicitud guardada. Dile a Valentin que ya escribiste /start para activar las propuestas y decisiones compartidas.",
  );
  return NextResponse.json({ ok: true, access: "pending", inserted });
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const header = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return NextResponse.json({ error: "telegram_not_configured" }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (update.message) {
    const messageChatId = String(update.message.chat?.id || "");
    const messageFromId = String(update.message.from?.id || "");
    const command = parseNotificationCommand(update.message.text || "");
    if (!messageChatId || !command) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    if (!isPrivateTelegramIdentity({
      chatId: messageChatId,
      chatType: update.message.chat?.type,
      fromId: messageFromId,
    })) {
      return NextResponse.json({ ok: true, ignored: "private_chat_required" });
    }
    const sb = getSupabaseService();
    if (!sb) return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    try {
      return await handleMessage(update.message, sb, botToken, chatId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "message_failed";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  const callback = update.callback_query;
  if (!callback?.id || !callback.data) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callbackChatId = String(callback.message?.chat?.id || "");
  const callbackFromId = String(callback.from?.id || "");
  const config = { botToken, chatId: callbackChatId || chatId };
  const privateIdentity = isPrivateTelegramIdentity({
    chatId: callbackChatId,
    chatType: callback.message?.chat?.type,
    fromId: callbackFromId,
  });
  if (!privateIdentity) {
    try { await answerCallback(config, callback.id, "Usuario no autorizado"); } catch { /* fail closed */ }
    return NextResponse.json({ ok: true, unauthorized_operator: true });
  }

  const sb = getSupabaseService();
  if (!sb) return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });

  let decisionActor = "";
  if (isValidOperatorCallbackIdentity({
    operatorChatId: chatId,
    messageChatId: callbackChatId,
    messageChatType: callback.message?.chat?.type,
    callbackFromId,
  })) {
    decisionActor = "telegram_operator";
  } else {
    try {
      const member = await loadNotificationMember(sb, callbackChatId);
      if (member?.status === "active") {
        decisionActor = `telegram_team:${member.firstName || member.username || member.chatId}`;
      }
    } catch {
      decisionActor = "";
    }
  }
  if (!decisionActor) {
    try { await answerCallback(config, callback.id, "Usuario no autorizado"); } catch { /* fail closed */ }
    return NextResponse.json({ ok: true, unauthorized_operator: true });
  }

  try {
    const { action, draftId, draftVersion } = parseApprovalCallback(callback.data);
    const { data: draft, error } = await sb
      .from("mc_drafts")
      .select("id,title,body,status,version,metadata")
      .eq("id", draftId)
      .maybeSingle();
    if (error || !draft) throw new Error("draft_not_found");
    const callbackMessageId = Number(callback.message?.message_id || 0);
    const registeredMessage = normalizeTelegramApprovalMessages(draft.metadata).find(
      (message) =>
        message.chatId === callbackChatId &&
        message.messageId === callbackMessageId &&
        message.draftVersion === draftVersion,
    );
    if (!registeredMessage) {
      try { await answerCallback(config, callback.id, "Botón antiguo o no registrado"); } catch { /* stale */ }
      if (callbackMessageId && callback.message?.text) {
        try {
          await editProposalResult(
            config,
            callbackMessageId,
            callback.message.text,
            "⚠️ PROPUESTA DESACTUALIZADA · espera la versión nueva",
          );
        } catch { /* convergence job will retry tracked messages */ }
      }
      return NextResponse.json({ ok: true, stale: true, draftId, draftVersion });
    }

    const now = new Date().toISOString();
    const terminal = ["scheduled", "publishing", "published", "failed", "rejected"].includes(draft.status);
    if (!terminal && Number(draft.version) !== draftVersion) {
      try { await answerCallback(config, callback.id, "Esa propuesta cambió de versión"); } catch { /* stale */ }
      if (callbackMessageId && callback.message?.text) {
        try {
          await editProposalResult(
            config,
            callbackMessageId,
            callback.message.text,
            "⚠️ PROPUESTA DESACTUALIZADA · espera la versión nueva",
          );
        } catch { /* convergence job will retry */ }
      }
      return NextResponse.json({ ok: true, stale: true, draftId, draftVersion });
    }
    let scheduledFor: string | null = null;
    let contentHash = "";
    let idempotencyKey = "";

    let decision: TelegramDecisionResult | null = null;
    for (let attempt = 0; attempt < 3 && !decision; attempt += 1) {
      if (action === "approve" && !terminal) {
        const [{ data: calendarRow, error: calendarError }, { data: occupiedRows, error: occupiedError }] =
          await Promise.all([
            sb.from("mc_system_settings").select("value")
              .eq("key", "weekly_content_calendar").maybeSingle(),
            sb.from("mc_publications").select("scheduled_for")
              .in("status", PUBLICATION_QUEUE_STATUSES).gte("scheduled_for", now),
          ]);
        if (calendarError || !calendarRow?.value || typeof calendarRow.value !== "object") {
          throw new Error("weekly_calendar_not_configured");
        }
        if (occupiedError) throw new Error(`publication_queue_lookup_failed:${occupiedError.message}`);
        const metadata = draft.metadata && typeof draft.metadata === "object"
          ? draft.metadata as Record<string, unknown>
          : {};
        const preferredDay = typeof metadata.calendar_day === "string" ? metadata.calendar_day : null;
        const slot = selectNextWeeklyContentSlot({
          calendar: calendarRow.value as Record<string, unknown>,
          occupied: (occupiedRows || []).map((row) => String(row.scheduled_for)),
          preferredDay,
          now: new Date(now),
        });
        scheduledFor = slot.scheduledFor;
        const intent = buildPublicationIntent({
          draftId,
          version: draftVersion + 1,
          body: draft.body,
          scheduledFor,
        });
        contentHash = intent.contentHash;
        idempotencyKey = intent.idempotencyKey;
      }

      const { data: rawDecision, error: decisionError } = await sb.rpc(
        "mc_decide_draft_telegram",
        {
          p_draft_id: draftId,
          p_expected_version: draftVersion,
          p_action: action,
          p_scheduled_for: scheduledFor,
          p_content_hash: contentHash,
          p_idempotency_key: idempotencyKey,
          p_actor: decisionActor,
          p_now: now,
        },
      );
      if (!decisionError) {
        decision = parseTelegramDecisionResult(rawDecision);
        break;
      }
      const conflict = decisionError.message.includes("mc_publications_active_scheduled_for_uidx");
      if (!conflict || attempt === 2) {
        throw new Error(`telegram_decision_failed:${decisionError.message}`);
      }
    }
    if (!decision) throw new Error("telegram_decision_failed:no_result");
    const answer = decision.decision === "approve"
      ? decision.applied
        ? `Aprobado y en cola: ${formatDecisionTime(decision.scheduled_for || scheduledFor)}.`
        : "Ya estaba aprobado. La primera decisión se mantiene."
      : decision.applied
        ? "Denegado. No se publica."
        : "Ya estaba denegado. La primera decisión se mantiene.";
    try { await answerCallback(config, callback.id, answer); } catch { /* decision is already committed */ }

    const sync = await syncTelegramDecisionMessages({
      sb,
      botToken,
      draftId,
      decision: decision.decision,
      fallbackScheduledFor: decision.scheduled_for || scheduledFor || undefined,
      currentChatId: callbackChatId,
      currentMessageId: callback.message?.message_id,
      currentDraftVersion: draftVersion,
    });
    return NextResponse.json({
      ok: true,
      requestedAction: action,
      decision: decision.decision,
      applied: decision.applied,
      draftId,
      sync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "callback_failed";
    if (message === "invalid_callback") {
      try { await answerCallback(config, callback.id, "Botón antiguo; espera la propuesta actualizada"); } catch { /* stale */ }
      const messageId = Number(callback.message?.message_id || 0);
      if (messageId && callback.message?.text) {
        try {
          await editProposalResult(
            config,
            messageId,
            callback.message.text,
            "⚠️ PROPUESTA DESACTUALIZADA · espera la versión nueva",
          );
        } catch { /* untracked legacy message */ }
      }
      return NextResponse.json({ ok: true, stale: true });
    }
    try {
      await answerCallback(config, callback.id, `Error: ${message.slice(0, 120)}`);
    } catch {
      // ignore secondary telegram failures
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
