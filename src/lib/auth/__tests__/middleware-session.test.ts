import { describe, expect, it, vi } from "vitest";
import { verifyMiddlewareSession } from "@/lib/auth/middleware-session";

const payload = {
  version: 1 as const,
  sid: "session-1",
  factor: "passkey" as const,
  iat: 1_000,
  exp: 9_000,
};
const config = {
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-role-test",
};

describe("middleware session verification", () => {
  it("accepts an active matching session record", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "session-1",
            factor: "passkey",
            expires_at: "2030-01-01T00:00:00.000Z",
            revoked_at: null,
          },
        ]),
        { status: 200 },
      ),
    );

    await expect(
      verifyMiddlewareSession(payload, config, fetcher, new Date("2029-01-01")),
    ).resolves.toBe(true);
  });

  it("fails closed for a revoked record or database failure", async () => {
    const revoked = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "session-1",
            factor: "passkey",
            expires_at: "2030-01-01T00:00:00.000Z",
            revoked_at: "2028-01-01T00:00:00.000Z",
          },
        ]),
        { status: 200 },
      ),
    );
    const failed = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      verifyMiddlewareSession(payload, config, revoked, new Date("2029-01-01")),
    ).resolves.toBe(false);
    await expect(
      verifyMiddlewareSession(payload, config, failed, new Date("2029-01-01")),
    ).resolves.toBe(false);
  });
});
