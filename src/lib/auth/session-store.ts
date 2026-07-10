import type { AuthFactor } from "@/lib/auth/session-token";

export type SessionRecord = {
  id: string;
  factor: string;
  expires_at: string;
  revoked_at: string | null;
};

export function isSessionRecordActive(
  record: SessionRecord | null,
  expectedId: string,
  expectedFactor: AuthFactor,
  now = new Date(),
) {
  return !!(
    record &&
    record.id === expectedId &&
    record.factor === expectedFactor &&
    !record.revoked_at &&
    new Date(record.expires_at).getTime() > now.getTime()
  );
}
