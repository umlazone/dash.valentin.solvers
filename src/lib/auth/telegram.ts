import type { AuthConfig } from "@/lib/auth/config";

type Fetcher = typeof fetch;

export async function sendTelegramOtp(
  config: AuthConfig,
  code: string,
  fetcher: Fetcher = fetch,
) {
  const response = await fetcher(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: [
          "🔐 SOLVERS · AGENCY OS",
          "",
          `Tu código de acceso es: ${code}`,
          "",
          "Vence en 5 minutos y solo puede usarse una vez.",
          "Si no lo solicitaste, ignora este mensaje.",
        ].join("\n"),
        protect_content: true,
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Telegram OTP delivery failed");
  }
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
  };
  if (!payload.ok) throw new Error("Telegram OTP delivery failed");
  return payload.result?.message_id ?? null;
}
