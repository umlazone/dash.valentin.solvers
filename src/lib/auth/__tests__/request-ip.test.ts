import { describe, expect, it } from "vitest";
import { trustedClientIp } from "@/lib/auth/request-ip";

describe("trusted client IP", () => {
  it("prefers Vercel's forwarded header over a client-shaped fallback", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
      "x-forwarded-for": "198.51.100.99",
    });
    expect(trustedClientIp(headers)).toBe("203.0.113.7");
  });

  it("uses the first forwarded address outside Vercel", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    });
    expect(trustedClientIp(headers)).toBe("203.0.113.8");
  });
});
