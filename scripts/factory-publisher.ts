#!/usr/bin/env npx tsx

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { validatePublicationDryRun } from "../src/lib/factory/validators";

function readEnvFile(path: string) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const split = line.indexOf("=");
      const key = line.slice(0, split).trim();
      let value = line.slice(split + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

function database() {
  readEnvFile(resolve(process.cwd(), ".env.local"));
  readEnvFile(resolve(homedir(), ".hermes/credentials/solvers-infra.env"));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("publisher_supabase_not_configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function hash(body: string) {
  return createHash("sha256").update(body.trim().replace(/\r\n/g, "\n")).digest("hex");
}

async function settings(db: ReturnType<typeof database>) {
  const { data, error } = await db.from("mc_system_settings").select("key,value");
  if (error) throw new Error(`publisher_settings_failed:${error.message}`);
  return Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

async function dryRun(db: ReturnType<typeof database>) {
  const { data: publications, error } = await db
    .from("mc_publications")
    .select("*")
    .eq("status", "queued")
    .lt("dry_run_count", 3)
    .order("scheduled_for", { ascending: true })
    .limit(5);
  if (error) throw new Error(`dry_run_queue_failed:${error.message}`);
  let passed = 0;
  let failed = 0;
  for (const publication of publications || []) {
    const { data: draft, error: draftError } = await db
      .from("mc_drafts")
      .select("*")
      .eq("id", publication.draft_id)
      .maybeSingle();
    if (draftError || !draft) {
      failed += 1;
      continue;
    }
    const result = validatePublicationDryRun({
      draftStatus: draft.status,
      approvedAt: draft.approved_at,
      body: publication.content_snapshot,
      contentHashMatches:
        hash(publication.content_snapshot) === publication.content_hash &&
        draft.body === publication.content_snapshot,
      alreadyPublished: Boolean(publication.x_post_id || draft.x_post_id),
    });
    const nextCount = result.ok ? Number(publication.dry_run_count || 0) + 1 : Number(publication.dry_run_count || 0);
    const { error: updateError } = await db
      .from("mc_publications")
      .update({
        dry_run_count: nextCount,
        status: result.ok && nextCount >= 3 ? "ready" : "queued",
        validation: result,
        error: result.ok ? null : result.errors.join(","),
      })
      .eq("id", publication.id)
      .eq("dry_run_count", Number(publication.dry_run_count || 0));
    if (updateError) throw new Error(`dry_run_update_failed:${updateError.message}`);
    await db.from("mc_events").insert({
      actor: "publisher_worker",
      event_type: result.ok ? "factory.publication_dry_run_passed" : "factory.publication_dry_run_failed",
      entity_type: "publication",
      entity_id: publication.id,
      payload: { dry_run_count: nextCount, errors: result.errors },
    });
    if (result.ok) passed += 1;
    else failed += 1;
  }
  console.log(JSON.stringify({ ok: true, mode: "dry_run", checked: (publications || []).length, passed, failed }));
}

function verifyXIdentity() {
  const output = execFileSync("xurl", ["whoami"], { encoding: "utf8", timeout: 30_000 });
  const payload = JSON.parse(output) as { data?: { username?: string } };
  if (payload.data?.username?.toLowerCase() !== "valentinflrz") {
    throw new Error("publisher_x_identity_mismatch");
  }
}

async function liveRun(db: ReturnType<typeof database>, config: Record<string, unknown>) {
  if (config.kill_switch === true) throw new Error("publisher_kill_switch_active");
  if (config.publisher_enabled !== true || config.publisher_mode !== "live") {
    console.log(JSON.stringify({ ok: true, mode: "live", published: 0, reason: "publisher_gate_off" }));
    return;
  }
  verifyXIdentity();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await db
    .from("mc_publications")
    .select("id", { head: true, count: "exact" })
    .eq("status", "published")
    .gte("published_at", start.toISOString());
  if (countError) throw new Error(`publisher_daily_count_failed:${countError.message}`);
  const dailyLimit = Number(config.daily_publish_limit || 2);
  const remaining = Math.max(0, dailyLimit - Number(count || 0));
  if (!remaining) {
    console.log(JSON.stringify({ ok: true, mode: "live", published: 0, reason: "daily_limit" }));
    return;
  }
  const worker = `publisher-${process.pid}`;
  const { data: claimed, error: claimError } = await db.rpc("mc_claim_publications", {
    p_worker: worker,
    p_limit: Math.min(remaining, 2),
    p_now: new Date().toISOString(),
  });
  if (claimError) throw new Error(`publisher_claim_failed:${claimError.message}`);
  let published = 0;
  for (const publication of claimed || []) {
    try {
      if (publication.dry_run_count < 3 || hash(publication.content_snapshot) !== publication.content_hash) {
        throw new Error("publisher_snapshot_gate_failed");
      }
      const output = execFileSync("xurl", ["post", publication.content_snapshot], {
        encoding: "utf8",
        timeout: 60_000,
      });
      const response = JSON.parse(output) as { data?: { id?: string } };
      const postId = response.data?.id;
      if (!postId) throw new Error("x_post_id_missing");
      const now = new Date().toISOString();
      const { error: updateError } = await db
        .from("mc_publications")
        .update({ status: "published", x_post_id: postId, published_at: now, error: null })
        .eq("id", publication.id)
        .eq("claimed_by", worker);
      if (updateError) throw new Error(`publication_complete_failed:${updateError.message}`);
      await db.from("mc_drafts").update({ status: "published", x_post_id: postId, published_at: now }).eq("id", publication.draft_id);
      await db.from("mc_events").insert({
        actor: "publisher_worker",
        event_type: "factory.publication_published",
        entity_type: "publication",
        entity_id: publication.id,
        payload: { x_post_id: postId },
      });
      published += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1_000) : "publisher_failed";
      await db.from("mc_publications").update({ status: "failed", error: message }).eq("id", publication.id).eq("claimed_by", worker);
      await db.from("mc_drafts").update({ status: "failed" }).eq("id", publication.draft_id).eq("status", "publishing");
    }
  }
  console.log(JSON.stringify({ ok: true, mode: "live", claimed: (claimed || []).length, published }));
}

async function main() {
  const db = database();
  const config = await settings(db);
  const requestedMode = process.argv.includes("--live") ? "live" : String(config.publisher_mode || "dry_run");
  if (requestedMode === "live") return liveRun(db, config);
  return dryRun(db);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "publisher_failed");
  process.exitCode = 1;
});
