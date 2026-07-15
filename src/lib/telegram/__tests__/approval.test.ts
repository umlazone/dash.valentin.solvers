import { describe, expect, it } from "vitest";
import {
  buildApprovalKeyboard,
  formatProposalMessage,
  parseApprovalCallback,
  selectNextWeeklyContentSlot,
} from "@/lib/telegram/approval";

const DRAFT_ID = "11111111-1111-4111-8111-111111111111";

describe("telegram content approval", () => {
  it("formats a short human proposal for the OTP bot", () => {
    const message = formatProposalMessage({
      title: "Junior con API key",
      body: "Autonomía sin dueño del job no es potencia.",
      language: "ES",
      angle: "Tendencia: agents 24/7 sin frenos",
    });
    expect(message).toContain("SOLVERS · PROPUESTA");
    expect(message).toContain("Junior con API key");
    expect(message).toContain("Autonomía sin dueño del job");
    expect(message).not.toContain("BEGIN_SOLVERS");
  });

  it("builds approve/decline callback data bound to a draft id and version", () => {
    const keyboard = buildApprovalKeyboard(DRAFT_ID, 7);
    expect(keyboard).toEqual({
      inline_keyboard: [
        [
          { text: "✅ Aprobar", callback_data: `mc:approve:${DRAFT_ID}:7` },
          { text: "❌ Declinar", callback_data: `mc:decline:${DRAFT_ID}:7` },
        ],
      ],
    });
  });

  it("puts approvals into the next free weekly slot in Bogotá", () => {
    const calendar = {
      timezone: "America/Bogota",
      monday: { time: "09:15", theme: "Caso real" },
      tuesday: { time: "12:30", theme: "Playbook" },
    };
    const monday = "2026-07-13T14:15:00.000Z";
    expect(
      selectNextWeeklyContentSlot({
        calendar,
        now: new Date("2026-07-11T20:00:00.000Z"),
        occupied: [],
        preferredDay: "monday",
      }),
    ).toMatchObject({ day: "monday", time: "09:15", scheduledFor: monday });

    expect(
      selectNextWeeklyContentSlot({
        calendar,
        now: new Date("2026-07-11T20:00:00.000Z"),
        occupied: [monday],
      }),
    ).toMatchObject({
      day: "tuesday",
      time: "12:30",
      scheduledFor: "2026-07-14T17:30:00.000Z",
    });
  });

  it("parses only version-bound approval callbacks", () => {
    expect(parseApprovalCallback(`mc:approve:${DRAFT_ID}:7`)).toEqual({
      action: "approve",
      draftId: DRAFT_ID,
      draftVersion: 7,
    });
    expect(parseApprovalCallback(`mc:decline:${DRAFT_ID}:7`)).toEqual({
      action: "decline",
      draftId: DRAFT_ID,
      draftVersion: 7,
    });
    expect(() => parseApprovalCallback(`mc:approve:${DRAFT_ID}`)).toThrow("invalid_callback");
    expect(() => parseApprovalCallback("mc:hack:nope")).toThrow("invalid_callback");
    expect(() => parseApprovalCallback("mc:approve:not-a-uuid")).toThrow("invalid_callback");
  });
});
