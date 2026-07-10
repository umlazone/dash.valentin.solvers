const formats = new Set(["post", "thread", "reply", "quote", "case", "playbook", "question"]);

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function xUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || !["x.com", "twitter.com"].includes(host)) {
      throw new Error("invalid");
    }
    url.hostname = "x.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    throw new Error("invalid_research_payload");
  }
}

export type ResearchPayload = ReturnType<typeof parseResearchPayload>;

export function parseResearchPayload(value: unknown) {
  const input = (value || {}) as Record<string, unknown>;
  const summary = text(input.summary, 2_000);
  const queries = Array.isArray(input.queries)
    ? input.queries.map((query) => text(query, 300)).filter(Boolean).slice(0, 12)
    : [];
  if (!summary || !queries.length) throw new Error("invalid_research_payload");
  if (!Array.isArray(input.signals) || input.signals.length > 20) {
    throw new Error("research_signal_limit");
  }
  if (!Array.isArray(input.drafts) || input.drafts.length > 3) {
    throw new Error("research_draft_limit");
  }
  const signals = input.signals.map((raw) => {
    const row = (raw || {}) as Record<string, unknown>;
    const sourceUrl = xUrl(row.sourceUrl);
    const sourceText = text(row.sourceText, 4_000);
    const mechanism = text(row.mechanism, 500);
    const solversAngle = text(row.solversAngle, 1_500);
    if (!sourceText || !mechanism || !solversAngle) {
      throw new Error("invalid_research_payload");
    }
    const requestedFormat = text(row.contentFormat, 30) || "post";
    return {
      sourceUrl,
      sourcePostId: text(row.sourcePostId, 80) || sourceUrl.split("/").pop() || null,
      sourceAuthor: text(row.sourceAuthor, 80).replace(/^@/, "") || null,
      sourceText,
      mechanism,
      evidence: text(row.evidence, 1_000) || null,
      solversAngle,
      contentFormat: formats.has(requestedFormat) ? requestedFormat : "post",
      language: row.language === "EN" ? ("EN" as const) : ("ES" as const),
      score: Math.max(0, Math.min(100, Math.round(Number(row.score ?? 50) || 50))),
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? row.metadata
          : {},
    };
  });
  const sourceUrls = new Set(signals.map((signal) => signal.sourceUrl));
  const drafts = input.drafts.map((raw) => {
    const row = (raw || {}) as Record<string, unknown>;
    const sourceUrl = xUrl(row.sourceUrl);
    const title = text(row.title, 180);
    const body = text(row.body, 25_000);
    if (!sourceUrls.has(sourceUrl) || !title || !body) {
      throw new Error("invalid_research_payload");
    }
    const requestedFormat = text(row.contentType, 30) || "post";
    return {
      sourceUrl,
      title,
      hook: text(row.hook, 500) || null,
      body,
      contentType: formats.has(requestedFormat) ? requestedFormat : "post",
      language: row.language === "EN" ? ("EN" as const) : ("ES" as const),
      area: text(row.area, 120) || null,
      score: Math.max(0, Math.min(100, Math.round(Number(row.score ?? 50) || 50))),
    };
  });
  return { summary, queries, signals, drafts };
}
