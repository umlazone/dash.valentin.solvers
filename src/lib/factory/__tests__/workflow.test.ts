import { describe, expect, it } from "vitest";
import {
  assertDraftTransition,
  buildPublicationIntent,
  signalFingerprint,
} from "@/lib/factory/workflow";

describe("content factory workflow", () => {
  it("permits only explicit draft transitions", () => {
    expect(() =>
      assertDraftTransition("draft", "in_review", {
        body: "Un caso real con suficiente contexto para revisar.",
      }),
    ).not.toThrow();
    expect(() =>
      assertDraftTransition("draft", "published", {
        body: "No puede saltarse aprobación ni agenda.",
      }),
    ).toThrow("invalid_transition");
    expect(() =>
      assertDraftTransition("in_review", "approved", { body: "" }),
    ).toThrow("body_required");
  });

  it("requires a future schedule before entering scheduled", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(() =>
      assertDraftTransition("approved", "scheduled", {
        body: "Texto aprobado.",
        scheduledFor: "2026-07-10T11:59:00.000Z",
        now,
      }),
    ).toThrow("future_schedule_required");
    expect(() =>
      assertDraftTransition("approved", "scheduled", {
        body: "Texto aprobado.",
        scheduledFor: "2026-07-10T13:00:00.000Z",
        now,
      }),
    ).not.toThrow();
  });

  it("builds deterministic publication keys that change with content", () => {
    const first = buildPublicationIntent({
      draftId: "draft-1",
      version: 2,
      body: "Texto aprobado",
      scheduledFor: "2026-07-10T13:00:00.000Z",
    });
    const same = buildPublicationIntent({
      draftId: "draft-1",
      version: 2,
      body: "Texto aprobado",
      scheduledFor: "2026-07-10T13:00:00.000Z",
    });
    const changed = buildPublicationIntent({
      draftId: "draft-1",
      version: 3,
      body: "Texto aprobado con cambio",
      scheduledFor: "2026-07-10T13:00:00.000Z",
    });
    expect(first).toEqual(same);
    expect(first.idempotencyKey).not.toBe(changed.idempotencyKey);
    expect(first.contentHash).toHaveLength(64);
  });

  it("deduplicates research signals by canonical source", () => {
    expect(
      signalFingerprint({
        sourceUrl: "https://x.com/AlexFinn/status/123?utm_source=test",
        sourceText: "  Agents   run overnight. ",
      }),
    ).toBe(
      signalFingerprint({
        sourceUrl: "https://x.com/alexfinn/status/123",
        sourceText: "Agents run overnight.",
      }),
    );
  });
});
