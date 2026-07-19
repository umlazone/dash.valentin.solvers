type DraftRow = Record<string, unknown>;
type PublicationRow = Record<string, unknown>;
type MetricRow = Record<string, unknown>;

type LearningInput = {
  drafts: DraftRow[];
  publications: PublicationRow[];
  metrics: MetricRow[];
};

const acceptedStatuses = new Set(["approved", "scheduled", "publishing", "published"]);
const correctionStatuses = new Set(["changes_requested", "rejected"]);

function text(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metadataFormula(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (typeof metadata.formula === "string") return text(metadata.formula, 240) || null;
  const formulaValue = metadata.creatorFormula || metadata.creator_formula;
  if (formulaValue && typeof formulaValue === "object") {
    const formula = formulaValue as Record<string, unknown>;
    return {
      hookType: text(formula.hookType, 120) || null,
      structure: text(formula.structure, 240) || null,
      proofDevice: text(formula.proofDevice, 180) || null,
      endingType: text(formula.endingType, 120) || null,
    };
  }
  return null;
}

function summarizeDraft(row: DraftRow) {
  return {
    id: text(row.id, 80),
    title: text(row.title, 180),
    hook: text(row.hook, 300) || null,
    body: text(row.body, 500),
    status: text(row.status, 40),
    contentType: text(row.content_type, 40) || "post",
    formula: metadataFormula(row.metadata),
    feedback: text(row.change_request, 500) || null,
    qualityChecks:
      row.quality_checks && typeof row.quality_checks === "object" && !Array.isArray(row.quality_checks)
        ? row.quality_checks
        : {},
    updatedAt: text(row.updated_at, 40) || null,
  };
}

export function buildEditorialLearningSnapshot(input: LearningInput) {
  const drafts = [...input.drafts].sort((a, b) =>
    text(b.updated_at, 40).localeCompare(text(a.updated_at, 40)),
  );
  const accepted = drafts
    .filter((row) => acceptedStatuses.has(text(row.status, 40)))
    .slice(0, 12)
    .map(summarizeDraft);
  const rejectedOrRevised = drafts
    .filter((row) => correctionStatuses.has(text(row.status, 40)))
    .slice(0, 12)
    .map(summarizeDraft);

  const metricsByPublication = new Map<string, Array<Record<string, unknown>>>();
  for (const row of input.metrics) {
    const publicationId = text(row.publication_id, 80);
    if (!publicationId) continue;
    const current = metricsByPublication.get(publicationId) || [];
    current.push({
      window: text(row.window_label, 20),
      impressions: numberOrNull(row.impressions),
      likes: numberOrNull(row.likes),
      replies: numberOrNull(row.replies),
      reposts: numberOrNull(row.reposts),
      quotes: numberOrNull(row.quotes),
      bookmarks: numberOrNull(row.bookmarks),
      profileClicks: numberOrNull(row.profile_clicks),
      urlClicks: numberOrNull(row.url_clicks),
      capturedAt: text(row.captured_at, 40) || null,
    });
    metricsByPublication.set(publicationId, current);
  }

  const publishedOutcomes = [...input.publications]
    .filter((row) => text(row.status, 40) === "published")
    .sort((a, b) => text(b.published_at, 40).localeCompare(text(a.published_at, 40)))
    .slice(0, 12)
    .map((row) => {
      const publicationId = text(row.id, 80);
      return {
        publicationId,
        draftId: text(row.draft_id, 80),
        content: text(row.content_snapshot, 500),
        publishedAt: text(row.published_at, 40) || null,
        metrics: metricsByPublication.get(publicationId) || [],
      };
    });

  return { accepted, rejectedOrRevised, publishedOutcomes };
}
