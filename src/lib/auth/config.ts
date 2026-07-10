export type AuthConfig = {
  telegramBotToken: string;
  telegramChatId: string;
  authSecret: string;
  webAuthnRpId: string;
  webAuthnOrigin: string;
  webAuthnRpName: string;
};

type EnvLike = Record<string, string | undefined>;

export function readAuthConfig(env: EnvLike = process.env): AuthConfig {
  const required = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "MC_AUTH_SECRET",
    "WEBAUTHN_RP_ID",
    "WEBAUTHN_ORIGIN",
    "WEBAUTHN_RP_NAME",
  ] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Auth configuration missing: ${missing.join(", ")}`);
  }
  if ((env.MC_AUTH_SECRET?.length || 0) < 32) {
    throw new Error("MC_AUTH_SECRET must contain at least 32 characters");
  }
  return {
    telegramBotToken: env.TELEGRAM_BOT_TOKEN!,
    telegramChatId: env.TELEGRAM_CHAT_ID!,
    authSecret: env.MC_AUTH_SECRET!,
    webAuthnRpId: env.WEBAUTHN_RP_ID!,
    webAuthnOrigin: env.WEBAUTHN_ORIGIN!,
    webAuthnRpName: env.WEBAUTHN_RP_NAME!,
  };
}
