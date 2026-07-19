import { describe, expect, it } from "vitest";
import { buildEditorialLearningSnapshot } from "@/lib/factory/editorial-learning";

describe("editorial outcome learning", () => {
  it("separates positive decisions, corrections, and published metric evidence", () => {
    const snapshot = buildEditorialLearningSnapshot({
      drafts: [
        {
          id: "approved-1",
          title: "Caso real",
          hook: "El problema no era el modelo",
          body: "El problema no era el modelo. Era el proceso.",
          status: "scheduled",
          content_type: "post",
          change_request: null,
          metadata: { formula: "scar + opinion" },
          updated_at: "2026-07-18T12:00:00Z",
        },
        {
          id: "rejected-1",
          title: "Stack genérico",
          hook: "El futuro de los agentes",
          body: "Una lista de herramientas sin experiencia propia.",
          status: "rejected",
          content_type: "post",
          change_request: "Suena a brochure y no a Valentin.",
          metadata: { formula: "generic list" },
          updated_at: "2026-07-18T11:00:00Z",
        },
      ],
      publications: [
        {
          id: "publication-1",
          draft_id: "approved-1",
          status: "published",
          content_snapshot: "El problema no era el modelo. Era el proceso.",
          published_at: "2026-07-18T13:00:00Z",
        },
      ],
      metrics: [
        {
          publication_id: "publication-1",
          window_label: "24h",
          impressions: 1200,
          likes: 44,
          replies: 7,
          reposts: 5,
          bookmarks: 21,
          captured_at: "2026-07-19T13:00:00Z",
        },
      ],
    });

    expect(snapshot.accepted).toEqual([
      expect.objectContaining({ id: "approved-1", status: "scheduled", formula: "scar + opinion" }),
    ]);
    expect(snapshot.rejectedOrRevised).toEqual([
      expect.objectContaining({ id: "rejected-1", feedback: "Suena a brochure y no a Valentin." }),
    ]);
    expect(snapshot.publishedOutcomes).toEqual([
      expect.objectContaining({
        publicationId: "publication-1",
        draftId: "approved-1",
        metrics: [expect.objectContaining({ window: "24h", bookmarks: 21 })],
      }),
    ]);
  });

  it("normalizes persisted hourly creator formulas for the next learning session", () => {
    const snapshot = buildEditorialLearningSnapshot({
      drafts: [{
        id: "formula-1",
        title: "Fórmula aprendida",
        body: "Un post aprobado con una fórmula rastreable.",
        status: "approved",
        metadata: {
          creator_formula: {
            hookType: "Realidad incómoda",
            structure: "hook → prueba → criterio",
            proofDevice: "caso propio",
            endingType: "opinión",
          },
        },
        updated_at: "2026-07-19T10:00:00Z",
      }],
      publications: [],
      metrics: [],
    });
    expect(snapshot.accepted[0].formula).toEqual({
      hookType: "Realidad incómoda",
      structure: "hook → prueba → criterio",
      proofDevice: "caso propio",
      endingType: "opinión",
    });
  });

  it("bounds learning context and drops unrelated draft states", () => {
    const drafts = Array.from({ length: 40 }, (_, index) => ({
      id: `draft-${index}`,
      title: `Title ${index}`,
      body: "x".repeat(900),
      status: index % 2 === 0 ? "draft" : "approved",
      updated_at: `2026-07-${String((index % 9) + 10).padStart(2, "0")}T00:00:00Z`,
    }));
    const snapshot = buildEditorialLearningSnapshot({ drafts, publications: [], metrics: [] });
    expect(snapshot.accepted.length).toBeLessThanOrEqual(12);
    expect(snapshot.rejectedOrRevised).toEqual([]);
    expect(snapshot.accepted.every((item) => item.body.length <= 500)).toBe(true);
  });
});
