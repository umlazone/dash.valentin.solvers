import { describe, expect, it, vi } from "vitest";
import { factoryRequest } from "@/lib/factory/client";

describe("factoryRequest", () => {
  it("sends JSON actions and returns confirmed server data", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, id: "capture-1" }), { status: 201 }),
    );
    await expect(
      factoryRequest("/api/mc/captures", "POST", { title: "Caso" }, fetcher),
    ).resolves.toMatchObject({ ok: true, id: "capture-1" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/mc/captures",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Caso" }),
      }),
    );
  });

  it("surfaces the API error instead of pretending the action worked", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_transition" }), { status: 400 }),
    );
    await expect(
      factoryRequest("/api/mc/drafts", "PATCH", { action: "approve" }, fetcher),
    ).rejects.toThrow("invalid_transition");
  });
});
