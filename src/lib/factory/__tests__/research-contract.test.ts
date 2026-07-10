import { describe, expect, it } from "vitest";
import { parseResearchPayload } from "@/lib/factory/research-contract";

describe("Grok research contract", () => {
  it("accepts bounded original signals and draft proposals", () => {
    const parsed = parseResearchPayload({
      summary: "Tres mecanismos útiles para Solvers.",
      queries: ["agentic ops", "from:AlexFinn agents"],
      signals: [
        {
          sourceUrl: "https://x.com/AlexFinn/status/123",
          sourcePostId: "123",
          sourceAuthor: "@AlexFinn",
          sourceText: "Agents work overnight.",
          mechanism: "demo + proof",
          evidence: "Shows outcome before explanation.",
          solversAngle: "Lo que pasa cuando el agente vive dentro del workflow.",
          contentFormat: "post",
          language: "ES",
          score: 84,
        },
      ],
      drafts: [
        {
          sourceUrl: "https://x.com/AlexFinn/status/123",
          title: "El agente no necesita otra pestaña",
          body: "El problema no era el modelo. Era sacar el trabajo del lugar donde ocurre.",
          contentType: "post",
          language: "ES",
          score: 82,
        },
      ],
    });
    expect(parsed.signals[0]).toMatchObject({
      sourceAuthor: "AlexFinn",
      score: 84,
      language: "ES",
    });
    expect(parsed.drafts).toHaveLength(1);
  });

  it("enforces canonical X status identity and an approved author allowlist", () => {
    const base = {
      summary: "Research seguro",
      queries: ["agent reliability"],
      signals: [{
        sourceUrl: "https://twitter.com/AlexFinn/status/123?utm_source=x",
        sourcePostId: "forged",
        sourceAuthor: "@AlexFinn",
        sourceText: "Grounded source",
        mechanism: "Prueba operativa",
        solversAngle: "Ángulo Solvers",
        score: 90,
      }],
      drafts: [],
    };
    const parsed = parseResearchPayload(base, { allowedHandles: new Set(["alexfinn"]) });
    expect(parsed.signals[0]).toMatchObject({
      sourceUrl: "https://x.com/AlexFinn/status/123",
      sourcePostId: "123",
      sourceAuthor: "AlexFinn",
    });

    expect(() => parseResearchPayload({
      ...base,
      signals: [{ ...base.signals[0], sourceAuthor: "other" }],
    }, { allowedHandles: new Set(["alexfinn"]) })).toThrow("research_source_identity_mismatch");
    expect(() => parseResearchPayload({
      ...base,
      signals: [{ ...base.signals[0], sourceUrl: "https://x.com/unapproved/status/999", sourceAuthor: "unapproved" }],
    }, { allowedHandles: new Set(["alexfinn"]) })).toThrow("research_source_not_allowed");
  });

  it("rejects ungrounded or oversized research output", () => {
    expect(() =>
      parseResearchPayload({
        summary: "",
        queries: [],
        signals: [{ sourceUrl: "javascript:alert(1)", mechanism: "", solversAngle: "" }],
        drafts: [],
      }),
    ).toThrow("invalid_research_payload");
    expect(() =>
      parseResearchPayload({
        summary: "run",
        queries: ["q"],
        signals: Array.from({ length: 21 }, (_, index) => ({
          sourceUrl: `https://x.com/user/status/${index}`,
          sourceText: "source",
          mechanism: "hook",
          solversAngle: "angle",
          score: 70,
        })),
        drafts: [],
      }),
    ).toThrow("research_signal_limit");
  });
});
