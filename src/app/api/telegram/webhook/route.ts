import { NextRequest, NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import {
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
  isActiveNotificationMember,
  isPrivateTelegramIdentity,
  isValidOperatorCallbackIdentity,
  normalizeNotificationMember,
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
    description: "Telegram team member with read-only Solvers operating status access",
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
    return NextResponse.json({ ok: true, command, role: "team_read_only" });
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
        access: "read_only",
        username: member.username || null,
        operator_delivery_error: operatorDeliveryError,
      },
    });
    if (eventError) throw new Error(`team_event_failed:${eventError.message}`);
  }

  await sendTextMessage(
    { botToken, chatId },
    "Solicitud guardada. Dile a Valentin que ya escribiste /start para que active tu acceso de solo lectura.",
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

  const config = { botToken, chatId };
  const validOperator = isValidOperatorCallbackIdentity({
    operatorChatId: chatId,
    messageChatId: String(callback.message?.chat?.id || ""),
    messageChatType: callback.message?.chat?.type,
    callbackFromId: String(callback.from?.id || ""),
  });
  if (!validOperator) {
    try {
      await answerCallback(config, callback.id, "Operador no autorizado");
    } catch {
      // The authorization decision is still fail-closed.
    }
    return NextResponse.json({ ok: true, unauthorized_operator: true });
  }

  const sb = getSupabaseService();
  if (!sb) return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });

  try {
    const { action, draftId } = parseApprovalCallback(callback.data);
    const { data: draft, error } = await sb
      .from("mc_drafts")
      .select("id,title,body,status,version,metadata")
      .eq("id", draftId)
      .maybeSingle();
    if (error || !draft) throw new Error("draft_not_found");

    const now = new Date().toISOString();
    if (action === "approve") {
      if (["published", "publishing", "scheduled"].includes(draft.status)) {
        await answerCallback(config, callback.id, "Ese draft ya está publicado o en cola");
      } else {
        const [{ data: calendarRow, error: calendarError }, { data: occupiedRows, error: occupiedError }] =
          await Promise.all([
            sb
              .from("mc_system_settings")
              .select("value")
              .eq("key", "weekly_content_calendar")
              .maybeSingle(),
            sb
              .from("mc_publications")
              .select("scheduled_for")
              .in("status", PUBLICATION_QUEUE_STATUSES)
              .gte("scheduled_for", now),
          ]);
        if (calendarError || !calendarRow?.value || typeof calendarRow.value !== "object") {
          throw new Error("weekly_calendar_not_configured");
        }
        if (occupiedError) throw new Error(`publication_queue_lookup_failed:${occupiedError.message}`);
        const metadata = draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {};
        const preferredDay =
          "calendar_day" in metadata && typeof metadata.calendar_day === "string"
            ? metadata.calendar_day
            : null;
        const slot = selectNextWeeklyContentSlot({
          calendar: calendarRow.value as Record<string, unknown>,
          occupied: (occupiedRows || []).map((row) => String(row.scheduled_for)),
          preferredDay,
          now: new Date(now),
        });
        const approvedVersion = Number(draft.version || 1) + 1;
        const intent = buildPublicationIntent({
          draftId,
          version: approvedVersion,
          body: draft.body,
          scheduledFor: slot.scheduledFor,
        });
        const { error: updateError } = await sb
          .from("mc_drafts")
          .update({
            status: "approved",
            approved_at: now,
            change_request: null,
            updated_at: now,
            version: approvedVersion,
            metadata: {
              ...metadata,
              telegram_decision: "approved",
              telegram_decided_at: now,
              calendar_day: slot.day,
              calendar_time: slot.time,
            },
          })
          .eq("id", draftId)
          .eq("version", Number(draft.version || 1));
        if (updateError) throw new Error(updateError.message);
        const { data: publication, error: scheduleError } = await sb.rpc("mc_schedule_draft", {
          p_draft_id: draftId,
          p_expected_version: approvedVersion,
          p_scheduled_for: slot.scheduledFor,
          p_content_hash: intent.contentHash,
          p_idempotency_key: intent.idempotencyKey,
          p_now: now,
        });
        if (scheduleError) throw new Error(`auto_schedule_failed:${scheduleError.message}`);
        await sb.from("mc_events").insert({
          actor: "telegram_operator",
          event_type: "factory.draft_approved_telegram",
          entity_type: "draft",
          entity_id: draftId,
          payload: {
            channel: "otp_bot",
            auto_scheduled: true,
            scheduled_for: slot.scheduledFor,
            publication,
          },
        });
        const queueMessage = `Aprobado y en cola: ${slot.dayLabel} ${slot.time}.`;
        await answerCallback(config, callback.id, queueMessage);
        if (callback.message?.message_id && callback.message.text) {
          await editProposalResult(
            config,
            callback.message.message_id,
            callback.message.text,
            `✅ APROBADO · en cola para ${slot.dayLabel} ${slot.time}`,
          );
        }
      }
    } else {
      if (["published", "publishing"].includes(draft.status)) {
        await answerCallback(config, callback.id, "Ese draft ya se movió de estado");
      } else {
        const { error: updateError } = await sb
          .from("mc_drafts")
          .update({
            status: "rejected",
            updated_at: now,
            version: Number(draft.version || 1) + 1,
            metadata: {
              ...(draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {}),
              telegram_decision: "declined",
              telegram_decided_at: now,
            },
          })
          .eq("id", draftId);
        if (updateError) throw new Error(updateError.message);
        await sb.from("mc_events").insert({
          actor: "telegram_operator",
          event_type: "factory.draft_declined_telegram",
          entity_type: "draft",
          entity_id: draftId,
          payload: { channel: "otp_bot" },
        });
        await answerCallback(config, callback.id, "Declinado. No se publica.");
        if (callback.message?.message_id && callback.message.text) {
          await editProposalResult(
            config,
            callback.message.message_id,
            callback.message.text,
            "❌ DECLINADO · no se publica",
          );
        }
      }
    }
    return NextResponse.json({ ok: true, action, draftId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "callback_failed";
    try {
      await answerCallback(config, callback.id, `Error: ${message.slice(0, 120)}`);
    } catch {
      // ignore secondary telegram failures
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
