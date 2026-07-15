import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  answerCallback: vi.fn(async () => undefined),
  editProposalResult: vi.fn(async () => undefined),
  sendTextMessage: vi.fn(async () => ({ messageId: 1 })),
  getSupabaseService: vi.fn(() => ({})),
}));

vi.mock("@/lib/telegram/bot", () => ({
  answerCallback: mocks.answerCallback,
  editProposalResult: mocks.editProposalResult,
  sendTextMessage: mocks.sendTextMessage,
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseService: mocks.getSupabaseService }));

import { POST } from "@/app/api/telegram/webhook/route";

function request(body: unknown) {
  return new NextRequest("https://dashvalentinsolvers.vercel.app/api/telegram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": "webhook-secret",
    },
    body: JSON.stringify(body),
  });
}

describe("Telegram webhook authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    process.env.TELEGRAM_BOT_TOKEN = "123456:test-token";
    process.env.TELEGRAM_CHAT_ID = "1135608648";
  });

  it("ignores /start from a group before any database or Telegram action", async () => {
    const response = await POST(request({
      update_id: 1,
      message: {
        message_id: 10,
        text: "/start",
        from: { id: 2233445566, first_name: "Ana" },
        chat: { id: -1002233445566, type: "supergroup" },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, ignored: "private_chat_required" });
    expect(mocks.getSupabaseService).not.toHaveBeenCalled();
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
  });

  it("rejects callbacks unless both the private chat and sender are the configured operator", async () => {
    const response = await POST(request({
      update_id: 2,
      callback_query: {
        id: "callback-1",
        data: "mc:approve:11111111-1111-4111-8111-111111111111",
        from: { id: 9999999999 },
        message: {
          message_id: 11,
          text: "proposal",
          chat: { id: 1135608648, type: "private" },
        },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, unauthorized_operator: true });
    expect(mocks.answerCallback).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "1135608648" }),
      "callback-1",
      "Usuario no autorizado",
    );
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(mocks.editProposalResult).not.toHaveBeenCalled();
    expect(mocks.getSupabaseService).not.toHaveBeenCalled();
  });

  it("rejects an inactive member callback even in a private chat", async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mocks.getSupabaseService.mockReturnValueOnce({ from });

    const response = await POST(request({
      update_id: 3,
      callback_query: {
        id: "callback-2",
        data: "mc:approve:11111111-1111-4111-8111-111111111111",
        from: { id: 2233445566 },
        message: {
          message_id: 12,
          text: "forwarded proposal",
          chat: { id: 2233445566, type: "private" },
        },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, unauthorized_operator: true });
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(mocks.editProposalResult).not.toHaveBeenCalled();
    expect(mocks.getSupabaseService).toHaveBeenCalledOnce();
  });

  it("keeps an existing operator draft approval callback working and synchronizes it", async () => {
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Draft",
          body: "Texto listo",
          status: "scheduled",
          version: 3,
          metadata: {},
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Draft",
          body: "Texto listo",
          language: "ES",
          hook: "Ángulo",
          scheduled_for: "2026-07-15T14:00:00.000Z",
          metadata: {
            telegram_decided_by: "telegram_operator",
            telegram_approval_messages: [
              { chat_id: "1135608648", message_id: 13 },
            ],
          },
        },
        error: null,
      });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn(async () => ({
      data: { applied: false, decision: "approve", draft_status: "scheduled" },
      error: null,
    }));
    mocks.getSupabaseService.mockReturnValueOnce({ from, rpc });

    const response = await POST(request({
      update_id: 4,
      callback_query: {
        id: "callback-3",
        data: "mc:approve:11111111-1111-4111-8111-111111111111",
        from: { id: 1135608648 },
        message: {
          message_id: 13,
          text: "proposal",
          chat: { id: 1135608648, type: "private" },
        },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      requestedAction: "approve",
      decision: "approve",
      applied: false,
      draftId: "11111111-1111-4111-8111-111111111111",
      sync: { synced: 1, failures: 0 },
    });
    expect(rpc).toHaveBeenCalledWith(
      "mc_decide_draft_telegram",
      expect.objectContaining({ p_action: "approve", p_actor: "telegram_operator" }),
    );
    expect(mocks.answerCallback).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "1135608648" }),
      "callback-3",
      "Ya estaba aprobado. La primera decisión se mantiene.",
    );
    expect(mocks.editProposalResult).toHaveBeenCalledOnce();
  });

  it("allows an active member to decide and synchronizes both chats", async () => {
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({
        data: {
          value: {
            chatId: "2233445566",
            fromId: "2233445566",
            status: "active",
            firstName: "Ana",
            requestedAt: "2026-07-14T23:00:00.000Z",
            activatedAt: "2026-07-14T23:01:00.000Z",
            activatedBy: "operator_local",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Draft compartido",
          body: "Texto listo",
          status: "rejected",
          version: 2,
          metadata: {},
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Draft compartido",
          body: "Texto listo",
          language: "ES",
          hook: null,
          scheduled_for: null,
          metadata: {
            telegram_decided_by: "telegram_team:Ana",
            telegram_approval_messages: [
              { chat_id: "1135608648", message_id: 51 },
              { chat_id: "2233445566", message_id: 52 },
            ],
          },
        },
        error: null,
      });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn(async () => ({
      data: { applied: false, decision: "decline", draft_status: "rejected" },
      error: null,
    }));
    mocks.getSupabaseService.mockReturnValueOnce({ from, rpc });

    const response = await POST(request({
      update_id: 5,
      callback_query: {
        id: "callback-4",
        data: "mc:decline:22222222-2222-4222-8222-222222222222",
        from: { id: 2233445566 },
        message: {
          message_id: 52,
          text: "proposal",
          chat: { id: 2233445566, type: "private" },
        },
      },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      decision: "decline",
      applied: false,
      sync: { synced: 2, failures: 0 },
    });
    expect(rpc).toHaveBeenCalledWith(
      "mc_decide_draft_telegram",
      expect.objectContaining({ p_action: "decline", p_actor: "telegram_team:Ana" }),
    );
    expect(mocks.editProposalResult).toHaveBeenCalledTimes(2);
    expect(mocks.editProposalResult).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "1135608648" }),
      51,
      expect.any(String),
      expect.stringContaining("❌ DENEGADO"),
    );
  });
});
