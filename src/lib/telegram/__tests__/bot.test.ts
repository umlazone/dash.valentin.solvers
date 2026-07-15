import { describe, expect, it } from "vitest";
import { sendTextMessage } from "@/lib/telegram/bot";

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
});
