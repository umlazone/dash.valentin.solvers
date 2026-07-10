#!/usr/bin/env npx tsx

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createSessionToken } from "../src/lib/auth/session-token";

function load(path: string) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

type ApiBody = Record<string, unknown> & {
  factory?: unknown;
  capture?: { id: string };
  draft?: { id: string };
  publication?: { publication_id: string };
};

async function main() {
  load(resolve(process.cwd(), ".env.local"));
  load(resolve(homedir(), ".hermes/credentials/solvers-infra.env"));
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.MC_AUTH_SECRET;
  if (!supabaseUrl || !serviceKey || !secret) throw new Error("e2e_env_missing");
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const base = process.env.FACTORY_BASE_URL || "http://127.0.0.1:3010";
  const sessionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + 3600) * 1000).toISOString();
  const { error: sessionError } = await db.from("mc_sessions").insert({
    id: sessionId,
    factor: "passkey",
    expires_at: expiresAt,
  });
  if (sessionError) throw new Error(`e2e_session_failed:${sessionError.message}`);
  const token = await createSessionToken({ sid: sessionId, factor: "passkey", now, ttl: 3600 }, secret);
  const headers = { "Content-Type": "application/json", Cookie: `mc_session=${token}` };
  let captureId = "";
  let draftId = "";
  let publicationId = "";
  const steps: Array<{ step: string; status: number }> = [];

  async function call(path: string, method = "POST", payload?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      redirect: "manual",
    });
    const body = await response.json().catch(() => ({}));
    steps.push({ step: `${method} ${path}`, status: response.status });
    if (!response.ok) throw new Error(`${path}:${response.status}:${JSON.stringify(body)}`);
    return body as ApiBody;
  }

  try {
    const live = await call("/api/mc/live", "GET");
    if (!live.factory) throw new Error("factory_snapshot_missing");
    const capture = await call("/api/mc/captures", "POST", {
      title: "E2E · DO NOT PUBLISH",
      rawText: "Synthetic integration artifact. Must be deleted after three clean dry-runs.",
      captureType: "note",
      language: "ES",
      priority: 0,
    });
    const createdCapture = capture.capture;
    if (!createdCapture) throw new Error("e2e_capture_response_invalid");
    captureId = createdCapture.id;
    const draft = await call("/api/mc/drafts", "POST", {
      title: "E2E · DO NOT PUBLISH",
      body: "E2E factory validation artifact. This text must never be published on X.",
      captureId,
      contentType: "post",
      language: "ES",
    });
    const createdDraft = draft.draft;
    if (!createdDraft) throw new Error("e2e_draft_response_invalid");
    draftId = createdDraft.id;
    await call("/api/mc/drafts", "PATCH", { id: draftId, action: "submit_review", expectedVersion: 1 });
    await call("/api/mc/drafts", "PATCH", { id: draftId, action: "approve", expectedVersion: 1 });
    const scheduled = await call("/api/mc/schedule", "POST", {
      draftId,
      scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const createdPublication = scheduled.publication;
    if (!createdPublication) throw new Error("e2e_schedule_response_invalid");
    publicationId = createdPublication.publication_id;
    for (let index = 0; index < 3; index += 1) {
      await call("/api/mc/publications/dry-run", "POST", { publicationId });
    }
    const { data: ready, error: readyError } = await db
      .from("mc_publications")
      .select("status,dry_run_count,x_post_id")
      .eq("id", publicationId)
      .single();
    if (readyError || ready.status !== "ready" || ready.dry_run_count !== 3 || ready.x_post_id) {
      throw new Error(`e2e_ready_gate_failed:${readyError?.message || JSON.stringify(ready)}`);
    }
    console.log(JSON.stringify({ ok: true, steps, final: ready, published: false }));
  } finally {
    if (publicationId) await db.from("mc_publications").delete().eq("id", publicationId);
    if (draftId) {
      await db.from("mc_draft_revisions").delete().eq("draft_id", draftId);
      await db.from("mc_drafts").delete().eq("id", draftId);
    }
    if (captureId) await db.from("mc_captures").delete().eq("id", captureId);
    await db.from("mc_sessions").delete().eq("id", sessionId);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "factory_e2e_failed");
  process.exitCode = 1;
});
