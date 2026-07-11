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
} from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    from?: { id?: number };
    message?: {
      message_id?: number;
      chat?: { id?: number | string };
      text?: string;
    };
  };
};

function allowedChat(chatId: string | number | undefined) {
  return String(chatId || "") === String(process.env.TELEGRAM_CHAT_ID || "");
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

  const callback = update.callback_query;
  if (!callback?.id || !callback.data) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const config = { botToken, chatId };
  const messageChat = callback.message?.chat?.id;
  if (!allowedChat(messageChat)) {
    await answerCallback(config, callback.id, "Chat no autorizado");
    return NextResponse.json({ ok: true, unauthorized_chat: true });
  }

  try {
    const { action, draftId } = parseApprovalCallback(callback.data);
    const sb = getSupabaseService();
    if (!sb) throw new Error("supabase_not_configured");

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
              .in("status", ["queued", "validating", "ready", "publishing"])
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
