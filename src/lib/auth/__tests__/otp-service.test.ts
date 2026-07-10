import { describe, expect, it, vi } from "vitest";
import {
  requestTelegramOtp,
  verifyTelegramOtp,
  type OtpRepository,
} from "@/lib/auth/otp-service";

type Challenge = {
  id: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  consumed: boolean;
};

class MemoryOtpRepository implements OtpRepository {
  challenges = new Map<string, Challenge>();
  sessions: Array<{
    id: string;
    factor: string;
    expiresAt: string;
    enrollmentGrant: { id: string; expiresAt: string };
  }> = [];
  allowRequest = true;

  async reserveChallenge(input: {
    id: string;
    codeHash: string;
    expiresAt: string;
  }) {
    if (!this.allowRequest) return false;
    this.challenges.set(input.id, {
      ...input,
      attempts: 0,
      consumed: false,
    });
    return true;
  }

  async discardChallenge(id: string) {
    this.challenges.delete(id);
  }

  async consumeIfValid(input: {
    id: string;
    codeHash: string;
    now: string;
  }) {
    const row = this.challenges.get(input.id);
    if (
      !row ||
      row.consumed ||
      row.attempts >= 5 ||
      row.expiresAt <= input.now ||
      row.codeHash !== input.codeHash
    ) {
      if (row && !row.consumed) row.attempts += 1;
      return false;
    }
    row.consumed = true;
    return true;
  }

  async createSessionWithEnrollmentGrant(input: {
    id: string;
    factor: "telegram_otp" | "passkey";
    expiresAt: string;
    enrollmentGrant: { id: string; expiresAt: string };
  }) {
    this.sessions.push(input);
  }
}

const secret = "test-secret-that-is-longer-than-thirty-two-bytes";
const now = new Date("2026-07-09T20:00:00.000Z");

describe("Telegram OTP flow", () => {
  it("atomically reserves a hashed challenge before sending plaintext once", async () => {
    const repository = new MemoryOtpRepository();
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await requestTelegramOtp({
      repository,
      send,
      secret,
      ipHash: "ip-hash",
      now,
      idFactory: () => "challenge-1",
      generateCode: () => "123456",
    });

    expect(result.challengeId).toBe("challenge-1");
    expect(send).toHaveBeenCalledWith("123456");
    const stored = repository.challenges.get("challenge-1");
    expect(stored?.codeHash).not.toContain("123456");
    expect(stored?.expiresAt).toBe("2026-07-09T20:05:00.000Z");
  });

  it("discards the reservation if Telegram delivery fails", async () => {
    const repository = new MemoryOtpRepository();

    await expect(
      requestTelegramOtp({
        repository,
        send: vi.fn().mockRejectedValue(new Error("delivery")),
        secret,
        ipHash: "ip-hash",
        now,
        idFactory: () => "challenge-1",
        generateCode: () => "123456",
      }),
    ).rejects.toThrow("OTP delivery failed");
    expect(repository.challenges.size).toBe(0);
  });

  it("rate limits atomically without sending a challenge", async () => {
    const repository = new MemoryOtpRepository();
    repository.allowRequest = false;
    const send = vi.fn();

    await expect(
      requestTelegramOtp({
        repository,
        send,
        secret,
        ipHash: "ip-hash",
        now,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(send).not.toHaveBeenCalled();
    expect(repository.challenges.size).toBe(0);
  });

  it("consumes a matching code and creates a ten-minute one-use enrollment grant", async () => {
    const repository = new MemoryOtpRepository();
    await requestTelegramOtp({
      repository,
      send: vi.fn().mockResolvedValue(undefined),
      secret,
      ipHash: "ip-hash",
      now,
      idFactory: () => "challenge-1",
      generateCode: () => "123456",
    });
    const ids = vi
      .fn<() => string>()
      .mockReturnValueOnce("session-1")
      .mockReturnValueOnce("grant-1");

    const result = await verifyTelegramOtp({
      repository,
      secret,
      challengeId: "challenge-1",
      code: "123456",
      now,
      idFactory: ids,
    });

    expect(result).toEqual({
      sessionId: "session-1",
      factor: "telegram_otp",
      enrollmentGrantId: "grant-1",
    });
    expect(repository.sessions[0]?.enrollmentGrant).toEqual({
      id: "grant-1",
      expiresAt: "2026-07-09T20:10:00.000Z",
    });
  });

  it("rejects a wrong or reused code", async () => {
    const repository = new MemoryOtpRepository();
    await requestTelegramOtp({
      repository,
      send: vi.fn().mockResolvedValue(undefined),
      secret,
      ipHash: "ip-hash",
      now,
      idFactory: () => "challenge-1",
      generateCode: () => "123456",
    });

    await expect(
      verifyTelegramOtp({
        repository,
        secret,
        challengeId: "challenge-1",
        code: "999999",
        now,
      }),
    ).rejects.toMatchObject({ code: "invalid_or_expired" });

    await verifyTelegramOtp({
      repository,
      secret,
      challengeId: "challenge-1",
      code: "123456",
      now,
    });

    await expect(
      verifyTelegramOtp({
        repository,
        secret,
        challengeId: "challenge-1",
        code: "123456",
        now,
      }),
    ).rejects.toMatchObject({ code: "invalid_or_expired" });
  });
});
