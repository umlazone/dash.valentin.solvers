import { describe, expect, it } from "vitest";
import { assertMissionControl } from "@/lib/health";

describe("Mission Control test harness", () => {
  it("loads project modules through the @ alias", () => {
    expect(assertMissionControl()).toBe(true);
  });
});
