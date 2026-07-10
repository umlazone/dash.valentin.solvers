import { describe, expect, it, vi } from "vitest";
import { readAuthConfig } from "@/lib/auth/config";
import { sendTelegramOtp, sendTelegramSecurityNotice } from "@/lib/auth/telegram";

const env = {
  TELEGRAM_BOT_TOKEN: "123456:telegram-test-token",
  TELEGRAM_CHAT_ID: "1135608648",
  MC_AUTH_SECRET: "test-secret-that-is-longer-than-thirty-two-bytes",
  WEBAUTHN_RP_ID: "dashvalentinsolvers.vercel.app",
  WEBAUTHN_ORIGIN: "https://dashvalentinsolvers.vercel.app",
  WEBAUTHN_RP_NAME: "Solvers Agency OS",
};

describe("auth config", () => {
  it("rejects incomplete or weak configuration", () => {
    expect(() => readAuthConfig({})).toThrow("Auth configuration missing");
    expect(() =>
      readAuthConfig({ ...env, MC_AUTH_SECRET: "too-short" }),
    ).toThrow("MC_AUTH_SECRET");
  });

  it("loads the fixed Telegram destination and WebAuthn origin", () => {
    const config = readAuthConfig(env);

    expect(config.telegramChatId).toBe("1135608648");
    expect(config.webAuthnOrigin).toBe("https://dashvalentinsolvers.vercel.app");
  });
});

describe("Telegram OTP sender", () => {
  it("sends a protected message only to the configured chat", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), {
        status: 200,
      }),
    );

    await sendTelegramOtp(readAuthConfig(env), "123456", fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.telegram.org/bot");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: "1135608648",
      protect_content: true,
    });
    expect(String(init.body)).toContain("123456");
  });

  it("sends a protected security notice after passkey enrollment", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), {
        status: 200,
      }),
    );

    await sendTelegramSecurityNotice(
      readAuthConfig(env),
      "Nueva passkey registrada.",
      fetcher,
    );

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.chat_id).toBe("1135608648");
    expect(body.protect_content).toBe(true);
    expect(body.text).toContain("Nueva passkey registrada");
  });

  it("does not expose the bot token when Telegram rejects the send", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "bad token" }), {
        status: 401,
      }),
    );

    await expect(
      sendTelegramOtp(readAuthConfig(env), "123456", fetcher),
    ).rejects.toThrow("Telegram OTP delivery failed");
    await expect(
      sendTelegramOtp(readAuthConfig(env), "123456", fetcher),
    ).rejects.not.toThrow(env.TELEGRAM_BOT_TOKEN);
  });
});
