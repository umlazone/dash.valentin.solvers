import type { AuthConfig } from "@/lib/auth/config";

type Fetcher = typeof fetch;

async function sendProtectedMessage(
  config: AuthConfig,
  text: string,
  failureMessage: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        protect_content: true,
      }),
    },
  );
  if (!response.ok) throw new Error(failureMessage);
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
  };
  if (!payload.ok) throw new Error(failureMessage);
  return payload.result?.message_id ?? null;
}

export function sendTelegramOtp(
  config: AuthConfig,
  code: string,
  fetcher: Fetcher = fetch,
) {
  return sendProtectedMessage(
    config,
    [
      "🔐 SOLVERS · AGENCY OS",
      "",
      `Tu código de acceso es: ${code}`,
      "",
      "Vence en 5 minutos y solo puede usarse una vez.",
      "Si no lo solicitaste, ignora este mensaje.",
    ].join("\n"),
    "Telegram OTP delivery failed",
    fetcher,
  );
}

export function sendTelegramSecurityNotice(
  config: AuthConfig,
  message: string,
  fetcher: Fetcher = fetch,
) {
  return sendProtectedMessage(
    config,
    [
      "🛡️ SOLVERS · SECURITY",
      "",
      message,
      "",
      "Si no reconoces esta acción, entra por Telegram y revoca el acceso.",
    ].join("\n"),
    "Telegram security notice failed",
    fetcher,
  );
}
