import { describe, expect, it } from "vitest";
import { extractResearchEnvelope } from "@/lib/factory/research-output";

const payload = {
  summary: "Resumen",
  queries: ["agents"],
  signals: [],
  drafts: [],
};

describe("extractResearchEnvelope", () => {
  it("extracts exactly one bounded JSON envelope from Hermes quiet output", () => {
    const output = [
      "session_id: 20260710_example",
      "BEGIN_SOLVERS_JSON",
      JSON.stringify(payload),
      "END_SOLVERS_JSON",
    ].join("\n");

    expect(extractResearchEnvelope(output)).toEqual(payload);
  });

  it("rejects missing or repeated envelopes", () => {
    expect(() => extractResearchEnvelope(JSON.stringify(payload))).toThrow("research_envelope_missing");
    const repeated = `BEGIN_SOLVERS_JSON\n${JSON.stringify(payload)}\nEND_SOLVERS_JSON\nBEGIN_SOLVERS_JSON\n{}\nEND_SOLVERS_JSON`;
    expect(() => extractResearchEnvelope(repeated)).toThrow("research_envelope_ambiguous");
  });

  it("rejects oversized model output before parsing", () => {
    expect(() => extractResearchEnvelope("x".repeat(100_001))).toThrow("research_output_too_large");
  });
});
