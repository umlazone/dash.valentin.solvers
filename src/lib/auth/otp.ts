import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(challengeId: string, code: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function hashRequestIdentity(
  ip: string,
  userAgent: string,
  secret: string,
) {
  return createHmac("sha256", secret)
    .update(`${ip}|${userAgent}`)
    .digest("hex");
}

export function verifyOtpHash(
  expectedHash: string,
  challengeId: string,
  code: string,
  secret: string,
) {
  const actual = Buffer.from(hashOtp(challengeId, code, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
