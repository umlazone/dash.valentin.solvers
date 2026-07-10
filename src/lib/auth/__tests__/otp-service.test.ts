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
  sessions: Array<{ id: string; factor: string; expiresAt: string }> = [];
  allowRequest = true;

  async canRequest() {
    return this.allowRequest;
  }

  async createChallenge(input: {
    id: string;
    codeHash: string;
    expiresAt: string;
  }) {
    this.challenges.set(input.id, {
      ...input,
      attempts: 0,
      consumed: false,
    });
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

  async createSession(input: {
    id: string;
    factor: "telegram_otp" | "passkey";
    expiresAt: string;
  }) {
    this.sessions.push(input);
  }
}

const secret = "test-secret-that-is-longer-than-thirty-two-bytes";
const now = new Date("2026-07-09T20:00:00.000Z");

describe("Telegram OTP flow", () => {
  it("stores only a hash and sends the plaintext code once", async () => {
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

  it("discards the challenge if Telegram delivery fails", async () => {
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

  it("rate limits without creating or sending a challenge", async () => {
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

  it("consumes a matching code and creates an OTP session", async () => {
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

    const result = await verifyTelegramOtp({
      repository,
      secret,
      challengeId: "challenge-1",
      code: "123456",
      now,
      idFactory: () => "session-1",
    });

    expect(result).toEqual({ sessionId: "session-1", factor: "telegram_otp" });
    expect(repository.challenges.get("challenge-1")?.consumed).toBe(true);
    expect(repository.sessions).toHaveLength(1);
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
    ).rejects.toMatchObject({
      code: "invalid_or_expired",
    });

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
    ).rejects.toMatchObject({
      code: "invalid_or_expired",
    });
  });
});
