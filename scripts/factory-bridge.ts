#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildEditorialLearningSnapshot } from "../src/lib/factory/editorial-learning";
import { parseResearchPayload } from "../src/lib/factory/research-contract";
import { signalFingerprint } from "../src/lib/factory/workflow";

function readEnvFile(path: string) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional source. Missing files are handled by required env checks below.
  }
}

function env() {
  readEnvFile(resolve(process.cwd(), ".env.local"));
  readEnvFile(resolve(homedir(), ".hermes/credentials/solvers-infra.env"));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("factory_bridge_supabase_not_configured");
  return { url, key };
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function client() {
  const config = env();
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function exportContext() {
  const output = argument("--output");
  if (!output) throw new Error("context_output_required");
  const db = client();
  const [signals, captures, drafts, publications, metrics, settings] = await Promise.all([
    db.from("mc_signals").select("fingerprint,source_url,source_author,source_text,mechanism,evidence,solvers_angle,content_format,language,status,score,metadata,discovered_at").order("discovered_at", { ascending: false }).limit(100),
    db.from("mc_captures").select("id,title,raw_text,capture_type,area,status,captured_at").in("status", ["new", "triaged"]).order("priority", { ascending: false }).limit(30),
    db.from("mc_drafts").select("id,title,hook,body,status,content_type,change_request,quality_checks,area,metadata,approved_at,published_at,updated_at").order("updated_at", { ascending: false }).limit(80),
    db.from("mc_publications").select("id,draft_id,status,content_snapshot,published_at,metadata").order("updated_at", { ascending: false }).limit(60),
    db.from("mc_post_metrics").select("publication_id,window_label,impressions,likes,replies,reposts,quotes,bookmarks,profile_clicks,url_clicks,captured_at").order("captured_at", { ascending: false }).limit(120),
    db.from("mc_system_settings").select("key,value"),
  ]);
  for (const result of [signals, captures, drafts, publications, metrics, settings]) {
    if (result.error) throw new Error(`context_query_failed:${result.error.message}`);
  }
  const editorialLearning = buildEditorialLearningSnapshot({
    drafts: drafts.data || [],
    publications: publications.data || [],
    metrics: metrics.data || [],
  });
  const payload = {
    generatedAt: new Date().toISOString(),
    existingSignals: signals.data || [],
    openCaptures: captures.data || [],
    existingDrafts: drafts.data || [],
    editorialLearning,
    settings: Object.fromEntries((settings.data || []).map((row) => [row.key, row.value])),
  };
  writeFileSync(resolve(output), JSON.stringify(payload, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, output: resolve(output), counts: {
    signals: payload.existingSignals.length,
    captures: payload.openCaptures.length,
    drafts: payload.existingDrafts.length,
    acceptedLearnings: payload.editorialLearning.accepted.length,
    correctionLearnings: payload.editorialLearning.rejectedOrRevised.length,
    publishedOutcomes: payload.editorialLearning.publishedOutcomes.length,
  } }));
}

async function ingestResearch() {
  const inputPath = argument("--input");
  const model = argument("--model") || "grok-4.5";
  if (!inputPath) throw new Error("research_input_required");
  const parsed = parseResearchPayload(JSON.parse(readFileSync(resolve(inputPath), "utf8")));
  const db = client();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await db
    .from("mc_research_runs")
    .insert({
      run_type: "x_grok",
      mode: "recurring",
      status: "running",
      model,
      query_count: parsed.queries.length,
      source_window: { queries: parsed.queries },
      started_at: startedAt,
    })
    .select("id")
    .single();
  if (runError) throw new Error(`research_run_create_failed:${runError.message}`);
  try {
    const rows = parsed.signals.map((signal) => ({
      fingerprint: signalFingerprint({ sourceUrl: signal.sourceUrl, sourceText: signal.sourceText }),
      research_run_id: run.id,
      source_platform: "x",
      source_author: signal.sourceAuthor,
      source_url: signal.sourceUrl,
      source_post_id: signal.sourcePostId,
      source_text: signal.sourceText,
      creator_handle: signal.sourceAuthor,
      raw_ref: signal.sourceUrl,
      mechanism: signal.mechanism,
      evidence: signal.evidence,
      solvers_angle: signal.solversAngle,
      content_format: signal.contentFormat,
      language: signal.language,
      score: signal.score,
      status: "new",
      metadata: signal.metadata,
    }));
    const fingerprints = rows.map((row) => row.fingerprint);
    if (rows.length) {
      const { error } = await db.from("mc_signals").upsert(rows, {
        onConflict: "fingerprint",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(`signal_upsert_failed:${error.message}`);
    }
    const { data: persistedSignals, error: persistedError } = fingerprints.length
      ? await db.from("mc_signals").select("id,fingerprint,source_url").in("fingerprint", fingerprints)
      : { data: [], error: null };
    if (persistedError) throw new Error(`signal_lookup_failed:${persistedError.message}`);
    const signalByUrl = new Map((persistedSignals || []).map((row) => [row.source_url, row]));
    let draftCount = 0;
    for (const proposal of parsed.drafts) {
      const signal = signalByUrl.get(proposal.sourceUrl);
      if (!signal) continue;
      const { data: existing, error: existingError } = await db
        .from("mc_drafts")
        .select("id")
        .contains("metadata", { source_fingerprint: signal.fingerprint })
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error(`draft_dedupe_failed:${existingError.message}`);
      if (existing) continue;
      const { data: draft, error: draftError } = await db
        .from("mc_drafts")
        .insert({
          title: proposal.title,
          hook: proposal.hook,
          body: proposal.body,
          preview: proposal.body.slice(0, 320),
          signal_id: signal.id,
          source: "grok_research",
          content_type: proposal.contentType,
          language: proposal.language,
          area: proposal.area,
          score: proposal.score,
          status: "draft",
          metadata: { source_fingerprint: signal.fingerprint, research_run_id: run.id },
        })
        .select("id")
        .single();
      if (draftError) throw new Error(`research_draft_create_failed:${draftError.message}`);
      const { error: revisionError } = await db.from("mc_draft_revisions").insert({
        draft_id: draft.id,
        version: 1,
        title: proposal.title,
        body: proposal.body,
        author: "grok_research",
      });
      if (revisionError) throw new Error(`research_revision_create_failed:${revisionError.message}`);
      await db.from("mc_signals").update({ status: "shortlisted" }).eq("id", signal.id);
      draftCount += 1;
    }
    const finishedAt = new Date().toISOString();
    const { error: finishError } = await db
      .from("mc_research_runs")
      .update({
        status: "completed",
        signal_count: rows.length,
        summary: parsed.summary,
        finished_at: finishedAt,
        metadata: { drafts_created: draftCount },
      })
      .eq("id", run.id);
    if (finishError) throw new Error(`research_run_finish_failed:${finishError.message}`);
    await db.from("mc_events").insert({
      actor: "grok_research",
      event_type: "factory.research_completed",
      entity_type: "research_run",
      entity_id: run.id,
      payload: { signals_received: rows.length, drafts_created: draftCount, model },
    });
    console.log(JSON.stringify({ ok: true, runId: run.id, signals: rows.length, drafts: draftCount }));
  } catch (error) {
    await db
      .from("mc_research_runs")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 1_000) : "research_ingest_failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "context") return exportContext();
  if (command === "ingest") return ingestResearch();
  throw new Error("usage: factory-bridge.ts context --output FILE | ingest --input FILE --model MODEL");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "factory_bridge_failed");
  process.exitCode = 1;
});
