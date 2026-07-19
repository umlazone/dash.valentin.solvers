import { describe, expect, it } from "vitest";
import {
  buildHourlyBriefPrompt,
  buildHourlyXurlQueries,
  parseHourlyBrief,
} from "@/lib/factory/hourly-brief";

describe("hourly recommendation learning", () => {
  it("builds a prompt that studies registered creators and learns from real outcomes", () => {
    const prompt = buildHourlyBriefPrompt({
      fromDate: "2026-07-18",
      toDate: "2026-07-19",
      existingTitles: ["Un post anterior"],
      creatorHandles: ["AlexFinn", "levelsio", "isamquintero"],
      creatorContext: "trusted creator registry",
      editorialLearning: {
        accepted: [{ title: "Caso humano", formula: "scar + opinion" }],
        rejectedOrRevised: [{ title: "Stack genérico", feedback: "Suena a brochure" }],
        publishedOutcomes: [{ draftId: "1", metrics: [{ window: "24h", bookmarks: 21 }] }],
      },
    });
    expect(prompt).toContain("REGISTERED CREATORS");
    expect(prompt).toContain("isamquintero");
    expect(prompt).toContain("EDITORIAL OUTCOMES");
    expect(prompt).toContain("creatorFormula");
    expect(prompt).toContain("sourceUrls");
    expect(prompt).toContain("one owned Solvers insight or proof");
  });

  it("validates formula metadata and canonical source URLs for each proposal", () => {
    const brief = parseHourlyBrief({
      summary: "Una señal clara.",
      trends: ["agentes gestionados"],
      posts: [{
        title: "El loop no era el problema",
        body: "El problema no era el prompt. Era dejar al agente sin herramientas ni memoria.",
        angle: "Arquitectura aplicada a una lección Solvers",
        language: "ES",
        sourceUrls: [
          "https://x.com/isamquintero/status/2078591888286790024?s=20",
          "javascript:alert(1)",
        ],
        creatorFormula: {
          hookType: "Autoridad + realidad incómoda",
          proofDevice: "Fuente concreta",
          structure: "hook → tensión → opinión",
          endingType: "criterio",
          reuseRule: "Cambiar la prueba por una experiencia propia",
          antiCopyBoundary: "No copiar la apertura ni el CTA",
          unknown: "drop",
        },
      }],
    });
    expect(brief.posts[0]).toMatchObject({
      sourceUrls: ["https://x.com/isamquintero/status/2078591888286790024"],
      creatorFormula: {
        hookType: "Autoridad + realidad incómoda",
        proofDevice: "Fuente concreta",
        structure: "hook → tensión → opinión",
        endingType: "criterio",
        reuseRule: "Cambiar la prueba por una experiencia propia",
        antiCopyBoundary: "No copiar la apertura ni el CTA",
      },
    });
  });

  it("adds a bounded registered-creator query before generic trend queries", () => {
    const queries = buildHourlyXurlQueries(
      ["AlexFinn", "levelsio", "isamquintero"],
      ["generic one", "generic two", "generic three"],
    );
    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain("from:AlexFinn");
    expect(queries[0]).toContain("from:isamquintero");
    expect(queries).not.toContain("generic three");
  });
});
