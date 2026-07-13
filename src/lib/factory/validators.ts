const captureTypes = new Set([
  "case",
  "roadblock",
  "win",
  "close",
  "tool",
  "playbook",
  "question",
  "voice_note",
  "note",
]);

export function parseCaptureInput(value: unknown) {
  const input = (value || {}) as Record<string, unknown>;
  const title = String(input.title || "").trim();
  const rawText = String(input.rawText || "").trim();
  if (!title || !rawText) throw new Error("capture_content_required");
  if (title.length > 180 || rawText.length > 20_000) {
    throw new Error("capture_too_long");
  }
  const requestedType = String(input.captureType || "note");
  if (!captureTypes.has(requestedType)) throw new Error("invalid_capture_type");
  const language = input.language === "EN" ? "EN" : "ES";
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 12)
    : [];
  return {
    title,
    rawText,
    captureType: requestedType,
    sourceType: String(input.sourceType || "operator"),
    sourceRef: input.sourceRef ? String(input.sourceRef).trim() : null,
    language,
    area: input.area ? String(input.area).trim() : null,
    tags,
    priority: Math.max(0, Math.min(100, Number(input.priority ?? 50) || 50)),
  };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function parseScheduleInput(value: unknown, now = new Date()) {
  const input = (value || {}) as Record<string, unknown>;
  const draftId = String(input.draftId || "");
  if (!uuidPattern.test(draftId)) throw new Error("valid_draft_id_required");
  const date = new Date(String(input.scheduledFor || ""));
  if (Number.isNaN(date.getTime()) || date <= now) {
    throw new Error("future_schedule_required");
  }
  return { draftId, scheduledFor: date.toISOString() };
}

const MAX_X_POST_LENGTH = 270;

export function buildPublisherExecutionPlan(mode: string) {
  return mode === "live" ? (["dry_run", "live"] as const) : (["dry_run"] as const);
}

export function validatePublicationDryRun(input: {
  draftStatus: string;
  approvedAt: string | null;
  body: string;
  contentHashMatches: boolean;
  alreadyPublished: boolean;
}) {
  const errors: string[] = [];
  const normalizedBody = input.body.trim();
  if (input.draftStatus !== "scheduled") errors.push("draft_not_scheduled");
  if (!input.approvedAt) errors.push("human_approval_missing");
  if (!normalizedBody) errors.push("body_required");
  if (normalizedBody.length > MAX_X_POST_LENGTH) errors.push("x_content_too_long");
  if (/\bTODO\b|\[X\]|\{\{.+?\}\}/u.test(normalizedBody)) {
    errors.push("unresolved_placeholder");
  }
  if (!input.contentHashMatches) errors.push("content_changed_after_schedule");
  if (input.alreadyPublished) errors.push("already_published");
  return {
    ok: errors.length === 0,
    checks: {
      scheduled: input.draftStatus === "scheduled",
      approved: Boolean(input.approvedAt),
      contentPresent: normalizedBody.length > 0,
      withinXLimit: normalizedBody.length <= MAX_X_POST_LENGTH,
      snapshotMatches: input.contentHashMatches,
      unique: !input.alreadyPublished,
    },
    errors,
  };
}
