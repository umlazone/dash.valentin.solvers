import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyFactorySnapshot,
  type FactorySnapshot,
} from "@/lib/factory/types";

export async function loadFactorySnapshot(
  client: SupabaseClient,
): Promise<FactorySnapshot> {
  const [capturesRes, signalsRes, draftsRes, publicationsRes, runsRes, settingsRes] =
    await Promise.all([
      client
        .from("mc_captures")
        .select("*")
        .neq("status", "archived")
        .order("priority", { ascending: false })
        .order("captured_at", { ascending: false })
        .limit(60),
      client
        .from("mc_signals")
        .select("*")
        .neq("status", "archived")
        .order("score", { ascending: false })
        .order("discovered_at", { ascending: false })
        .limit(80),
      client.from("mc_drafts").select("*").neq("status", "archived").order("updated_at", {
        ascending: false,
      }).limit(80),
      client.from("mc_publications").select("*").order("scheduled_for", {
        ascending: true,
      }).limit(80),
      client.from("mc_research_runs").select("*").order("started_at", {
        ascending: false,
      }).limit(20),
      client.from("mc_system_settings").select("key,value"),
    ]);

  const failure = [capturesRes, signalsRes, draftsRes, publicationsRes, runsRes, settingsRes].find(
    (result) => result.error,
  );
  if (failure?.error) throw new Error(`factory_snapshot_failed:${failure.error.message}`);

  const captures = (capturesRes.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    rawText: row.raw_text,
    captureType: row.capture_type,
    sourceType: row.source_type,
    language: row.language,
    area: row.area,
    tags: row.tags || [],
    priority: Number(row.priority || 0),
    status: row.status,
    capturedAt: row.captured_at,
    updatedAt: row.updated_at,
  }));
  const signals = (signalsRes.data || []).map((row) => ({
    id: row.id,
    fingerprint: row.fingerprint,
    sourceAuthor: row.source_author || row.creator_handle,
    sourceUrl: row.source_url || row.raw_ref,
    sourceText: row.source_text,
    mechanism: row.mechanism,
    evidence: row.evidence,
    solversAngle: row.solvers_angle,
    contentFormat: row.content_format,
    language: row.language,
    score: Number(row.score || 0),
    status: row.status,
    discoveredAt: row.discovered_at || row.created_at,
  }));
  const drafts = (draftsRes.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    hook: row.hook,
    body: row.body || row.preview || "",
    preview: row.preview || row.body || "",
    status: row.status,
    language: row.language || "ES",
    area: row.area,
    contentType: row.content_type || "post",
    score: Number(row.score || 0),
    version: Number(row.version || 1),
    changeRequest: row.change_request,
    captureId: row.capture_id,
    signalId: row.signal_id,
    approvedAt: row.approved_at,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    xPostId: row.x_post_id,
    updatedAt: row.updated_at,
  }));
  const publications = (publicationsRes.data || []).map((row) => ({
    id: row.id,
    draftId: row.draft_id,
    draftVersion: Number(row.draft_version || 1),
    status: row.status,
    scheduledFor: row.scheduled_for,
    dryRunCount: Number(row.dry_run_count || 0),
    attemptCount: Number(row.attempt_count || 0),
    xPostId: row.x_post_id,
    error: row.error,
    validation: row.validation || {},
    updatedAt: row.updated_at,
  }));
  const researchRuns = (runsRes.data || []).map((row) => ({
    id: row.id,
    status: row.status,
    model: row.model,
    queryCount: Number(row.query_count || 0),
    signalCount: Number(row.signal_count || 0),
    summary: row.summary,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }));
  const settings = Object.fromEntries(
    (settingsRes.data || []).map((row) => [row.key, row.value]),
  );

  return {
    captures,
    signals,
    drafts,
    publications,
    researchRuns,
    settings: { ...emptyFactorySnapshot.settings, ...settings },
    counts: {
      capturesNew: captures.filter((item) => item.status === "new").length,
      signalsNew: signals.filter((item) => item.status === "new").length,
      draftsReview: drafts.filter((item) =>
        ["draft", "in_review", "changes_requested"].includes(item.status),
      ).length,
      approved: drafts.filter((item) => item.status === "approved").length,
      scheduled: publications.filter((item) =>
        ["queued", "validating", "ready", "publishing"].includes(item.status),
      ).length,
      published: publications.filter((item) => item.status === "published").length,
    },
  } as FactorySnapshot;
}
