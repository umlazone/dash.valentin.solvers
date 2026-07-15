import { describe, expect, it } from "vitest";
import {
  enableProposalControls,
  sendDraftProposal,
  sendTextMessage,
} from "@/lib/telegram/bot";

describe("Telegram bot text messages", () => {
  it("sends a read-only message to the selected chat with an optional keyboard", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> = {};
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        ok: true,
        result: { message_id: 42 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const keyboard = { inline_keyboard: [[{ text: "Dar acceso", callback_data: "mc:test" }]] };

    const result = await sendTextMessage(
      { botToken: "123456:test", chatId: "2233445566" },
      "Hola equipo",
      { replyMarkup: keyboard },
      fetcher,
    );

    expect(result).toEqual({ messageId: 42 });
    expect(requestUrl).toContain("/sendMessage");
    expect(requestBody).toMatchObject({
      chat_id: "2233445566",
      text: "Hola equipo",
      reply_markup: keyboard,
    });
  });

  it("sends a proposal without actionable controls until registration succeeds", async () => {
    let requestBody: Record<string, unknown> = {};
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ ok: true, result: { message_id: 43 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    await sendDraftProposal(
      { botToken: "123456:test", chatId: "2233445566" },
      {
        id: "11111111-1111-4111-8111-111111111111",
        version: 7,
        title: "Draft",
        body: "Texto",
        language: "ES",
      },
      { withControls: false },
      fetcher,
    );
    expect(requestBody).not.toHaveProperty("reply_markup");
  });

  it("enables only version-bound controls on a registered message", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> = {};
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    await enableProposalControls(
      { botToken: "123456:test", chatId: "2233445566" },
      43,
      "11111111-1111-4111-8111-111111111111",
      7,
      fetcher,
    );
    expect(requestUrl).toContain("/editMessageReplyMarkup");
    expect(requestBody).toMatchObject({
      chat_id: "2233445566",
      message_id: 43,
      reply_markup: {
        inline_keyboard: [[
          expect.objectContaining({ callback_data: "mc:approve:11111111-1111-4111-8111-111111111111:7" }),
          expect.objectContaining({ callback_data: "mc:decline:11111111-1111-4111-8111-111111111111:7" }),
        ]],
      },
    });
  });
});
