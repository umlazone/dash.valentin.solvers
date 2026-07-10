import { createHash } from "node:crypto";

export type DraftWorkflowStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "rejected"
  | "archived"
  | "cancelled";

const transitions: Record<DraftWorkflowStatus, DraftWorkflowStatus[]> = {
  draft: ["in_review", "rejected", "archived"],
  in_review: ["changes_requested", "approved", "rejected"],
  changes_requested: ["in_review", "rejected", "archived"],
  approved: ["scheduled", "changes_requested", "archived"],
  scheduled: ["approved", "publishing", "cancelled"],
  publishing: ["published", "failed"],
  failed: ["scheduled", "cancelled"],
  published: [],
  rejected: ["draft", "archived"],
  archived: [],
  cancelled: ["approved", "archived"],
};

export function assertDraftTransition(
  from: DraftWorkflowStatus,
  to: DraftWorkflowStatus,
  input: { body?: string | null; scheduledFor?: string | null; now?: Date },
) {
  if (!transitions[from]?.includes(to)) throw new Error("invalid_transition");
  if (["in_review", "approved", "scheduled"].includes(to) && !input.body?.trim()) {
    throw new Error("body_required");
  }
  if (to === "scheduled") {
    const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
    const now = input.now ?? new Date();
    if (!when || Number.isNaN(when.getTime()) || when <= now) {
      throw new Error("future_schedule_required");
    }
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildPublicationIntent(input: {
  draftId: string;
  version: number;
  body: string;
  scheduledFor: string;
}) {
  const normalizedBody = input.body.trim().replace(/\r\n/g, "\n");
  const contentHash = sha256(normalizedBody);
  const idempotencyKey = sha256(
    [input.draftId, input.version, contentHash, input.scheduledFor].join("|"),
  );
  return { contentHash, idempotencyKey };
}

export function signalFingerprint(input: {
  sourceUrl?: string | null;
  sourceText?: string | null;
}) {
  let canonicalUrl = "";
  if (input.sourceUrl) {
    try {
      const url = new URL(input.sourceUrl);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const canonicalHost = host === "twitter.com" ? "x.com" : host;
      canonicalUrl = `${url.protocol}//${canonicalHost}${url.pathname}`.toLowerCase();
    } catch {
      canonicalUrl = input.sourceUrl.trim().toLowerCase();
    }
  }
  const text = (input.sourceText || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return sha256(`${canonicalUrl}|${text}`);
}
