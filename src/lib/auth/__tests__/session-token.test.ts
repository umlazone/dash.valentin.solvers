import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session-token";
import { isSessionRecordActive } from "@/lib/auth/session-store";

const secret = "test-secret-that-is-longer-than-thirty-two-bytes";

describe("operator session token", () => {
  it("round-trips a signed operator session", async () => {
    const token = await createSessionToken(
      { sid: "session-1", factor: "telegram_otp", now: 1_000, ttl: 3_600 },
      secret,
    );

    await expect(verifySessionToken(token, secret, 2_000)).resolves.toEqual({
      version: 1,
      sid: "session-1",
      factor: "telegram_otp",
      iat: 1_000,
      exp: 4_600,
    });
  });

  it("rejects tampering", async () => {
    const token = await createSessionToken(
      { sid: "session-1", factor: "passkey", now: 1_000, ttl: 3_600 },
      secret,
    );
    const [payload, signature] = token.split(".");
    const tampered = `${payload}.${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;

    await expect(verifySessionToken(tampered, secret, 2_000)).resolves.toBeNull();
  });

  it("rejects expired sessions", async () => {
    const token = await createSessionToken(
      { sid: "session-1", factor: "passkey", now: 1_000, ttl: 60 },
      secret,
    );

    await expect(verifySessionToken(token, secret, 1_061)).resolves.toBeNull();
  });

  it("uses hardened cookie flags", () => {
    expect(sessionCookieOptions(3_600)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3_600,
    });
  });

  it("rejects revoked, expired or factor-mismatched session records", () => {
    const base = {
      id: "session-1",
      factor: "passkey",
      expires_at: "2026-07-10T00:00:00.000Z",
      revoked_at: null,
    };
    const now = new Date("2026-07-09T20:00:00.000Z");

    expect(isSessionRecordActive(base, "session-1", "passkey", now)).toBe(true);
    expect(
      isSessionRecordActive({ ...base, revoked_at: now.toISOString() }, "session-1", "passkey", now),
    ).toBe(false);
    expect(
      isSessionRecordActive({ ...base, expires_at: now.toISOString() }, "session-1", "passkey", now),
    ).toBe(false);
    expect(isSessionRecordActive(base, "session-1", "telegram_otp", now)).toBe(false);
  });
});
