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
      "Operador no autorizado",
    );
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(mocks.editProposalResult).not.toHaveBeenCalled();
    expect(mocks.getSupabaseService).not.toHaveBeenCalled();
  });

  it("rejects a member callback even when the member is in a private chat", async () => {
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
    expect(mocks.getSupabaseService).not.toHaveBeenCalled();
  });

  it("keeps an existing operator draft approval callback working", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Draft",
        body: "Texto listo",
        status: "scheduled",
        version: 3,
        metadata: {},
      },
      error: null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mocks.getSupabaseService.mockReturnValueOnce({ from });

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
      action: "approve",
      draftId: "11111111-1111-4111-8111-111111111111",
    });
    expect(mocks.answerCallback).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "1135608648" }),
      "callback-3",
      "Ese draft ya está publicado o en cola",
    );
  });
});
