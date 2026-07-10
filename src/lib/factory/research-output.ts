const START = "BEGIN_SOLVERS_JSON";
const END = "END_SOLVERS_JSON";
const MAX_OUTPUT_BYTES = 100_000;

export function extractResearchEnvelope(output: string): unknown {
  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
    throw new Error("research_output_too_large");
  }
  const starts = output.split(START).length - 1;
  const ends = output.split(END).length - 1;
  if (!starts || !ends) throw new Error("research_envelope_missing");
  if (starts !== 1 || ends !== 1) throw new Error("research_envelope_ambiguous");
  const start = output.indexOf(START) + START.length;
  const end = output.indexOf(END, start);
  if (end < start) throw new Error("research_envelope_invalid");
  const json = output.slice(start, end).trim();
  if (!json) throw new Error("research_envelope_invalid");
  try {
    return JSON.parse(json) as unknown;
  } catch {
    throw new Error("research_envelope_invalid");
  }
}
