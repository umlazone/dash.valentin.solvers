const formats = new Set(["post", "thread", "reply", "quote", "case", "playbook", "question"]);
const sourceKinds = new Set(["registered_creator", "official", "latam", "operator", "other"]);
const creatorFormulaFields = [
  ["hookType", 120],
  ["openingMove", 240],
  ["tension", 240],
  ["structure", 300],
  ["proofDevice", 240],
  ["payoff", 240],
  ["endingType", 120],
  ["whyItWorks", 300],
  ["reuseRule", 300],
  ["antiCopyBoundary", 300],
] as const;

type ResearchOptions = {
  allowedHandles?: ReadonlySet<string>;
};

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function signalMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  const sourceKind = text(input.sourceKind, 40);
  if (sourceKinds.has(sourceKind)) metadata.sourceKind = sourceKind;

  if (input.creatorFormula && typeof input.creatorFormula === "object" && !Array.isArray(input.creatorFormula)) {
    const raw = input.creatorFormula as Record<string, unknown>;
    const creatorFormula = Object.fromEntries(
      creatorFormulaFields.flatMap(([field, max]) => {
        const value = text(raw[field], max);
        return value ? [[field, value]] : [];
      }),
    );
    if (Object.keys(creatorFormula).length) metadata.creatorFormula = creatorFormula;
  }
  return metadata;
}

function xIdentity(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || !["x.com", "twitter.com"].includes(host)) throw new Error("invalid");
    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/([0-9]+)\/?$/u);
    if (!match) throw new Error("invalid");
    const [, handle, sourcePostId] = match;
    return {
      sourceUrl: `https://x.com/${handle}/status/${sourcePostId}`,
      sourceAuthor: handle,
      sourcePostId,
    };
  } catch {
    throw new Error("invalid_research_payload");
  }
}

export type ResearchPayload = ReturnType<typeof parseResearchPayload>;

export function parseResearchPayload(value: unknown, options: ResearchOptions = {}) {
  const input = (value || {}) as Record<string, unknown>;
  const summary = text(input.summary, 2_000);
  const queries = Array.isArray(input.queries)
    ? input.queries.map((query) => text(query, 300)).filter(Boolean).slice(0, 12)
    : [];
  if (!summary || !queries.length) throw new Error("invalid_research_payload");
  if (!Array.isArray(input.signals) || input.signals.length > 20) throw new Error("research_signal_limit");
  if (!Array.isArray(input.drafts) || input.drafts.length > 3) throw new Error("research_draft_limit");
  const approved = options.allowedHandles
    ? new Set(Array.from(options.allowedHandles, (handle) => handle.replace(/^@/u, "").toLowerCase()))
    : null;
  const seenSources = new Set<string>();
  const signals = input.signals.map((raw) => {
    const row = (raw || {}) as Record<string, unknown>;
    const identity = xIdentity(row.sourceUrl);
    const declaredAuthor = text(row.sourceAuthor, 80).replace(/^@/u, "");
    if (!declaredAuthor || declaredAuthor.toLowerCase() !== identity.sourceAuthor.toLowerCase()) {
      throw new Error("research_source_identity_mismatch");
    }
    if (approved && !approved.has(identity.sourceAuthor.toLowerCase())) {
      throw new Error("research_source_not_allowed");
    }
    if (seenSources.has(identity.sourcePostId)) throw new Error("research_source_duplicate");
    seenSources.add(identity.sourcePostId);
    const sourceText = text(row.sourceText, 4_000);
    const mechanism = text(row.mechanism, 500);
    const solversAngle = text(row.solversAngle, 1_500);
    if (!sourceText || !mechanism || !solversAngle) throw new Error("invalid_research_payload");
    const requestedFormat = text(row.contentFormat, 30) || "post";
    return {
      ...identity,
      sourceText,
      mechanism,
      evidence: text(row.evidence, 1_000) || null,
      solversAngle,
      contentFormat: formats.has(requestedFormat) ? requestedFormat : "post",
      language: row.language === "EN" ? ("EN" as const) : ("ES" as const),
      score: Math.max(0, Math.min(100, Math.round(Number(row.score ?? 50) || 50))),
      metadata: signalMetadata(row.metadata),
    };
  });
  const sourceUrls = new Set(signals.map((signal) => signal.sourceUrl));
  const drafts = input.drafts.map((raw) => {
    const row = (raw || {}) as Record<string, unknown>;
    const { sourceUrl } = xIdentity(row.sourceUrl);
    const title = text(row.title, 180);
    const body = text(row.body, 25_000);
    if (!sourceUrls.has(sourceUrl) || !title || !body) throw new Error("invalid_research_payload");
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
