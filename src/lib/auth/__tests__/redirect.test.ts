import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";

const origin = "https://dashvalentinsolvers.vercel.app";

describe("post-login redirect", () => {
  it("keeps valid internal paths", () => {
    expect(safeRedirectPath("/review?draft=1#top", origin)).toBe(
      "/review?draft=1#top",
    );
  });

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "\\\\evil.example/",
    "javascript:alert(1)",
  ])("rejects external or ambiguous target %s", (target) => {
    expect(safeRedirectPath(target, origin)).toBe("/");
  });
});
