import { generateOtp, hashOtp } from "@/lib/auth/otp";
import type { AuthFactor } from "@/lib/auth/session-token";

const OTP_TTL_MS = 5 * 60 * 1000;
const ENROLLMENT_GRANT_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type OtpRepository = {
  reserveChallenge(input: {
    id: string;
    codeHash: string;
    expiresAt: string;
    ipHash: string;
    now: string;
  }): Promise<boolean>;
  discardChallenge(id: string): Promise<void>;
  consumeIfValid(input: {
    id: string;
    codeHash: string;
    now: string;
  }): Promise<boolean>;
  createSessionWithEnrollmentGrant(input: {
    id: string;
    factor: AuthFactor;
    expiresAt: string;
    enrollmentGrant: { id: string; expiresAt: string };
  }): Promise<void>;
};

export class OtpFlowError extends Error {
  constructor(
    public readonly code:
      | "rate_limited"
      | "delivery_failed"
      | "invalid_or_expired",
    message: string,
  ) {
    super(message);
    this.name = "OtpFlowError";
  }
}

type RequestOtpInput = {
  repository: OtpRepository;
  send: (code: string) => Promise<unknown>;
  secret: string;
  ipHash: string;
  now?: Date;
  idFactory?: () => string;
  generateCode?: () => string;
};

export async function requestTelegramOtp(input: RequestOtpInput) {
  const now = input.now ?? new Date();
  const challengeId = input.idFactory?.() ?? crypto.randomUUID();
  const code = (input.generateCode ?? generateOtp)();
  const reserved = await input.repository.reserveChallenge({
    id: challengeId,
    codeHash: hashOtp(challengeId, code, input.secret),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    ipHash: input.ipHash,
    now: now.toISOString(),
  });
  if (!reserved) {
    throw new OtpFlowError("rate_limited", "OTP request rate limited");
  }
  try {
    await input.send(code);
  } catch {
    await input.repository.discardChallenge(challengeId);
    throw new OtpFlowError("delivery_failed", "OTP delivery failed");
  }
  return { challengeId };
}

type VerifyOtpInput = {
  repository: OtpRepository;
  secret: string;
  challengeId: string;
  code: string;
  now?: Date;
  idFactory?: () => string;
};

export async function verifyTelegramOtp(input: VerifyOtpInput) {
  if (!/^\d{6}$/u.test(input.code)) {
    throw new OtpFlowError("invalid_or_expired", "Invalid or expired code");
  }
  const now = input.now ?? new Date();
  const valid = await input.repository.consumeIfValid({
    id: input.challengeId,
    codeHash: hashOtp(input.challengeId, input.code, input.secret),
    now: now.toISOString(),
  });
  if (!valid) {
    throw new OtpFlowError("invalid_or_expired", "Invalid or expired code");
  }
  const sessionId = input.idFactory?.() ?? crypto.randomUUID();
  const enrollmentGrantId = input.idFactory?.() ?? crypto.randomUUID();
  const factor = "telegram_otp" as const;
  await input.repository.createSessionWithEnrollmentGrant({
    id: sessionId,
    factor,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    enrollmentGrant: {
      id: enrollmentGrantId,
      expiresAt: new Date(
        now.getTime() + ENROLLMENT_GRANT_TTL_MS,
      ).toISOString(),
    },
  });
  return { sessionId, factor, enrollmentGrantId };
}
