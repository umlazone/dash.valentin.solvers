import { describe, expect, it } from "vitest";
import {
  parseCaptureInput,
  parseScheduleInput,
  validatePublicationDryRun,
} from "@/lib/factory/validators";

describe("factory input validators", () => {
  it("normalizes a real capture", () => {
    expect(
      parseCaptureInput({
        title: "  Roadblock del cliente ",
        rawText: " Falló el handoff y tuvimos que rehacerlo. ",
        captureType: "roadblock",
        tags: [" ops ", "cliente"],
      }),
    ).toMatchObject({
      title: "Roadblock del cliente",
      rawText: "Falló el handoff y tuvimos que rehacerlo.",
      captureType: "roadblock",
      tags: ["ops", "cliente"],
    });
    expect(() => parseCaptureInput({ title: "", rawText: "" })).toThrow(
      "capture_content_required",
    );
  });

  it("requires a future ISO schedule", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(
      parseScheduleInput(
        {
          draftId: "3a90cf56-cd0e-4f96-9510-9e51eef5bef8",
          scheduledFor: "2026-07-10T14:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({ scheduledFor: "2026-07-10T14:00:00.000Z" });
    expect(() =>
      parseScheduleInput(
        {
          draftId: "3a90cf56-cd0e-4f96-9510-9e51eef5bef8",
          scheduledFor: "2026-07-10T11:00:00.000Z",
        },
        now,
      ),
    ).toThrow("future_schedule_required");
  });

  it("blocks unsafe publication snapshots and passes clean approved text", () => {
    expect(
      validatePublicationDryRun({
        draftStatus: "scheduled",
        approvedAt: "2026-07-10T12:00:00.000Z",
        body: "Esto aprendimos desplegando el sistema en un cliente real.",
        contentHashMatches: true,
        alreadyPublished: false,
      }),
    ).toEqual({ ok: true, checks: expect.any(Object), errors: [] });
    expect(
      validatePublicationDryRun({
        draftStatus: "draft",
        approvedAt: null,
        body: "TODO completar cifra [X]",
        contentHashMatches: false,
        alreadyPublished: false,
      }),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        "draft_not_scheduled",
        "human_approval_missing",
        "unresolved_placeholder",
        "content_changed_after_schedule",
      ]),
    });
  });
});
