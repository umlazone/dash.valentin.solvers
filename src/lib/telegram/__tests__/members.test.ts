import { describe, expect, it } from "vitest";
import {
  activateNotificationMember,
  activeNotificationChatIds,
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
} from "@/lib/telegram/members";

const MEMBER_CHAT_ID = "2233445566";

describe("Telegram team notification access", () => {
  it("recognizes only the supported read-only member commands", () => {
    expect(parseNotificationCommand("/start")).toBe("start");
    expect(parseNotificationCommand("/status@Accessportal_solversai_bot")).toBe("status");
    expect(parseNotificationCommand("hola")).toBeNull();
  });

  it("accepts only private chats where sender and chat are the same user", () => {
    expect(isPrivateTelegramIdentity({
      chatId: MEMBER_CHAT_ID,
      chatType: "private",
      fromId: MEMBER_CHAT_ID,
    })).toBe(true);
    expect(isPrivateTelegramIdentity({
      chatId: "-1002233445566",
      chatType: "supergroup",
      fromId: MEMBER_CHAT_ID,
    })).toBe(false);
    expect(isPrivateTelegramIdentity({
      chatId: MEMBER_CHAT_ID,
      chatType: "private",
      fromId: "9988776655",
    })).toBe(false);
  });

  it("requires the configured private operator identity for every existing callback", () => {
    expect(isValidOperatorCallbackIdentity({
      operatorChatId: "1135608648",
      messageChatId: "1135608648",
      messageChatType: "private",
      callbackFromId: "1135608648",
    })).toBe(true);
    expect(isValidOperatorCallbackIdentity({
      operatorChatId: "1135608648",
      messageChatId: "1135608648",
      messageChatType: "private",
      callbackFromId: "9999999999",
    })).toBe(false);
  });

  it("creates one pending member record that cannot grant its own access", () => {
    const pending = buildPendingNotificationMember({
      chatId: MEMBER_CHAT_ID,
      fromId: MEMBER_CHAT_ID,
      firstName: "Ana",
      username: "ana_team",
      now: "2026-07-14T23:00:00.000Z",
    });
    expect(pending).toEqual(expect.objectContaining({
      chatId: MEMBER_CHAT_ID,
      fromId: MEMBER_CHAT_ID,
      status: "pending",
    }));
    expect(normalizeNotificationMember(pending)).toEqual(pending);
    expect(isActiveNotificationMember(pending, MEMBER_CHAT_ID)).toBe(false);
    const active = activateNotificationMember(pending, {
      now: "2026-07-14T23:01:00.000Z",
      activatedBy: "operator_local",
    });
    expect(isActiveNotificationMember(active, MEMBER_CHAT_ID)).toBe(true);
    expect(normalizeNotificationMember({ ...active, activatedAt: undefined })).toBeNull();
    expect(normalizeNotificationMember({ ...active, activatedBy: undefined })).toBeNull();
    expect(notificationMemberKey(MEMBER_CHAT_ID)).toBe(`telegram_notification_member:${MEMBER_CHAT_ID}`);
  });

  it("lists active decision recipients once and keeps the operator last", () => {
    const pending = buildPendingNotificationMember({
      chatId: MEMBER_CHAT_ID,
      fromId: MEMBER_CHAT_ID,
      firstName: "Ana",
      now: "2026-07-14T23:00:00.000Z",
    });
    const active = activateNotificationMember(pending, {
      now: "2026-07-14T23:01:00.000Z",
      activatedBy: "operator_local",
    });
    expect(activeNotificationChatIds([
      { value: pending },
      { value: active },
      { value: active },
      { value: { nope: true } },
    ], "1135608648")).toEqual([MEMBER_CHAT_ID, "1135608648"]);
  });

  it("normalizes and deduplicates stored Telegram proposal messages", () => {
    expect(normalizeTelegramApprovalMessages({
      telegram_approval_messages: [
        { chat_id: "1135608648", message_id: 41, sent_at: "2026-07-14T23:00:00.000Z" },
        { chat_id: MEMBER_CHAT_ID, message_id: 42, sent_at: "2026-07-14T23:00:01.000Z" },
        { chat_id: MEMBER_CHAT_ID, message_id: 43, sent_at: "2026-07-14T23:00:02.000Z" },
        { chat_id: "-1001", message_id: 44 },
      ],
    })).toEqual([
      { chatId: "1135608648", messageId: 41 },
      { chatId: MEMBER_CHAT_ID, messageId: 43 },
    ]);
  });

  it("formats one canonical decision line for every mirrored message", () => {
    expect(formatTelegramDecisionLine({
      decision: "approve",
      scheduledFor: "2026-07-15T14:15:00.000Z",
      actor: "telegram_team:Ana",
    })).toContain("✅ APROBADO");
    expect(formatTelegramDecisionLine({
      decision: "decline",
      actor: "telegram_operator",
    })).toBe("❌ DENEGADO · no se publica · por Valentin");
  });

  it("sanitizes member names before showing a request to the operator", () => {
    const text = formatTeamAccessRequest({
      chatId: MEMBER_CHAT_ID,
      firstName: "Ana\n⚠️ Aprobar todo",
      username: "ana_team",
    });
    expect(text).toContain("Nombre: Ana ⚠️ Aprobar todo");
    expect(text).not.toContain("Ana\n");
    expect(text).toContain("La activación se hace manualmente");
    expect(text).toContain("primera decisión");
  });

  it("uses the Bogotá operating day instead of UTC", () => {
    expect(startOfBogotaDay(new Date("2026-07-15T02:00:00.000Z")).toISOString())
      .toBe("2026-07-14T05:00:00.000Z");
    expect(startOfBogotaDay(new Date("2026-07-15T06:00:00.000Z")).toISOString())
      .toBe("2026-07-15T05:00:00.000Z");
  });

  it("formats a useful read-only operating status without approval controls", () => {
    const text = formatTeamStatus({
      publisherLive: true,
      draftsInReview: 4,
      publicationsQueued: 3,
      publicationsFailed: 0,
      publishedToday: 2,
      nextScheduledFor: "2026-07-15T14:15:00.000Z",
    });
    expect(text).toContain("SOLVERS · ESTADO");
    expect(text).toContain("En revisión: 4");
    expect(text).toContain("Publicados hoy: 2");
    expect(text).toContain("Decisiones compartidas");
    expect(text).not.toContain("Solo lectura");
  });
});
