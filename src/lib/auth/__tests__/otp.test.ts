import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, hashRequestIdentity, verifyOtpHash } from "@/lib/auth/otp";

const secret = "test-secret-that-is-longer-than-thirty-two-bytes";

describe("Telegram OTP primitives", () => {
  it("generates exactly six numeric digits", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("stores a deterministic HMAC instead of the plaintext code", () => {
    const digest = hashOtp("challenge-a", "123456", secret);

    expect(digest).not.toContain("123456");
    expect(digest).toBe(hashOtp("challenge-a", "123456", secret));
    expect(digest).not.toBe(hashOtp("challenge-b", "123456", secret));
  });

  it("accepts only the matching challenge and code", () => {
    const digest = hashOtp("challenge-a", "123456", secret);

    expect(verifyOtpHash(digest, "challenge-a", "123456", secret)).toBe(true);
    expect(verifyOtpHash(digest, "challenge-a", "654321", secret)).toBe(false);
    expect(verifyOtpHash(digest, "challenge-b", "123456", secret)).toBe(false);
  });

  it("stores a one-way request identity instead of a raw IP", () => {
    const value = hashRequestIdentity("203.0.113.10", "Safari", secret);

    expect(value).not.toContain("203.0.113.10");
    expect(value).toBe(hashRequestIdentity("203.0.113.10", "Safari", secret));
    expect(value).not.toBe(hashRequestIdentity("203.0.113.11", "Safari", secret));
  });
});
