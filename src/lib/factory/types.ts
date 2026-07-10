export type FactoryCapture = {
  id: string;
  title: string;
  rawText: string;
  captureType: string;
  sourceType: string;
  language: "ES" | "EN";
  area: string | null;
  tags: string[];
  priority: number;
  status: "new" | "triaged" | "drafted" | "archived";
  capturedAt: string;
  updatedAt: string;
};

export type FactorySignal = {
  id: string;
  fingerprint: string | null;
  sourceAuthor: string | null;
  sourceUrl: string | null;
  sourceText: string | null;
  mechanism: string | null;
  evidence: string | null;
  solversAngle: string | null;
  contentFormat: string | null;
  language: "ES" | "EN";
  score: number;
  status: "new" | "shortlisted" | "used" | "dismissed" | "archived";
  discoveredAt: string;
};

export type FactoryDraft = {
  id: string;
  title: string;
  hook: string | null;
  body: string;
  preview: string;
  status: string;
  language: "ES" | "EN";
  area: string | null;
  contentType: string;
  score: number;
  version: number;
  changeRequest: string | null;
  captureId: string | null;
  signalId: string | null;
  approvedAt: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  xPostId: string | null;
  updatedAt: string;
};

export type FactoryPublication = {
  id: string;
  draftId: string;
  draftVersion: number;
  status: string;
  scheduledFor: string;
  dryRunCount: number;
  attemptCount: number;
  xPostId: string | null;
  error: string | null;
  validation: Record<string, unknown>;
  updatedAt: string;
};

export type FactoryResearchRun = {
  id: string;
  status: string;
  model: string | null;
  queryCount: number;
  signalCount: number;
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type FactorySnapshot = {
  captures: FactoryCapture[];
  signals: FactorySignal[];
  drafts: FactoryDraft[];
  publications: FactoryPublication[];
  researchRuns: FactoryResearchRun[];
  settings: Record<string, unknown>;
  counts: {
    capturesNew: number;
    signalsNew: number;
    draftsReview: number;
    approved: number;
    scheduled: number;
    published: number;
  };
};

export const emptyFactorySnapshot: FactorySnapshot = {
  captures: [],
  signals: [],
  drafts: [],
  publications: [],
  researchRuns: [],
  settings: {
    research_enabled: true,
    research_cadence_hours: 4,
    publisher_mode: "dry_run",
    publisher_enabled: false,
    kill_switch: false,
    daily_publish_limit: 2,
    approval_required: true,
  },
  counts: {
    capturesNew: 0,
    signalsNew: 0,
    draftsReview: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
  },
};
