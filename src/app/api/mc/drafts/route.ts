import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";
import {
  assertDraftTransition,
  type DraftWorkflowStatus,
} from "@/lib/factory/workflow";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof OperatorAuthError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "draft_operation_failed";
  const bad = [
    "draft_content_required",
    "invalid_transition",
    "body_required",
    "future_schedule_required",
    "change_request_required",
    "version_conflict",
  ].includes(message);
  return NextResponse.json({ error: message }, { status: bad ? 400 : 500 });
}

export async function POST(request: Request) {
  try {
    await requireOperator();
    const body = (await request.json()) as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const content = String(body.body || "").trim();
    if (!title || !content) throw new Error("draft_content_required");
    if (title.length > 180 || content.length > 25_000) {
      throw new Error("draft_content_required");
    }
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const captureId = body.captureId ? String(body.captureId) : null;
    const signalId = body.signalId ? String(body.signalId) : null;
    const { data: draft, error } = await client
      .from("mc_drafts")
      .insert({
        title,
        hook: body.hook ? String(body.hook).trim() : null,
        body: content,
        preview: content.slice(0, 320),
        cta: body.cta ? String(body.cta).trim() : null,
        area: body.area ? String(body.area).trim() : null,
        language: body.language === "EN" ? "EN" : "ES",
        content_type: body.contentType ? String(body.contentType) : "post",
        status: "draft",
        capture_id: captureId,
        signal_id: signalId,
        source: captureId ? "capture" : signalId ? "research_signal" : "operator",
        score: Number(body.score || 0),
      })
      .select("*")
      .single();
    if (error) throw new Error(`draft_create_failed:${error.message}`);
    const { error: revisionError } = await client.from("mc_draft_revisions").insert({
      draft_id: draft.id,
      version: 1,
      title,
      body: content,
      author: "operator",
    });
    if (revisionError) throw new Error(`revision_create_failed:${revisionError.message}`);
    if (captureId) {
      await client.from("mc_captures").update({ status: "drafted" }).eq("id", captureId);
    }
    if (signalId) {
      await client.from("mc_signals").update({ status: "used" }).eq("id", signalId);
    }
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: "factory.draft_created",
      entity_type: "draft",
      entity_id: draft.id,
      payload: { capture_id: captureId, signal_id: signalId },
    });
    return NextResponse.json({ ok: true, draft }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireOperator();
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "");
    if (!id) throw new Error("draft_id_required");
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const { data: current, error: lookupError } = await client
      .from("mc_drafts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw new Error(`draft_lookup_failed:${lookupError.message}`);
    if (!current) return NextResponse.json({ error: "draft_not_found" }, { status: 404 });

    let action = String(body.action || "");
    if (!action && body.status === "approved") action = "approve";
    if (!action && body.status === "pending") action = "request_changes";
    if (!action && body.status === "rejected") action = "reject";
    const actionTargets: Record<string, DraftWorkflowStatus> = {
      submit_review: "in_review",
      request_changes: "changes_requested",
      approve: "approved",
      reject: "rejected",
      archive: "archived",
    };
    const now = new Date().toISOString();
    const nextBody = body.body === undefined ? String(current.body || "") : String(body.body).trim();
    const contentChanged =
      body.body !== undefined ||
      body.title !== undefined ||
      body.hook !== undefined ||
      body.cta !== undefined;
    const nextVersion = contentChanged ? Number(current.version || 1) + 1 : Number(current.version || 1);
    const update: Record<string, unknown> = {};

    if (action === "save") {
      if (!nextBody || !String(body.title ?? current.title).trim()) {
        throw new Error("draft_content_required");
      }
      update.title = String(body.title ?? current.title).trim();
      update.body = nextBody;
      update.preview = nextBody.slice(0, 320);
      update.hook = body.hook === undefined ? current.hook : String(body.hook).trim();
      update.cta = body.cta === undefined ? current.cta : String(body.cta).trim();
      update.area = body.area === undefined ? current.area : String(body.area).trim();
      update.language = body.language === "EN" ? "EN" : current.language || "ES";
      update.content_type = body.contentType || current.content_type;
      update.version = nextVersion;
    } else {
      const target = actionTargets[action];
      if (!target) throw new Error("invalid_transition");
      if (target === "changes_requested" && !String(body.changeRequest || "").trim()) {
        throw new Error("change_request_required");
      }
      assertDraftTransition(current.status as DraftWorkflowStatus, target, {
        body: nextBody,
      });
      update.status = target;
      if (target === "changes_requested") {
        update.change_request = String(body.changeRequest).trim();
      }
      if (target === "in_review") update.change_request = null;
      if (target === "approved") {
        update.approved_at = now;
        update.approved_by = "operator";
        update.change_request = null;
      }
    }

    let query = client
      .from("mc_drafts")
      .update(update)
      .eq("id", id)
      .eq("status", current.status);
    if (body.expectedVersion !== undefined) {
      query = query.eq("version", Number(body.expectedVersion));
    }
    const { data: draft, error } = await query.select("*").maybeSingle();
    if (error) throw new Error(`draft_update_failed:${error.message}`);
    if (!draft) throw new Error("version_conflict");

    if (action === "save" && contentChanged) {
      const { error: revisionError } = await client.from("mc_draft_revisions").insert({
        draft_id: id,
        version: nextVersion,
        title: update.title,
        body: nextBody,
        change_request: current.change_request,
        author: "operator",
      });
      if (revisionError) throw new Error(`revision_create_failed:${revisionError.message}`);
    }
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: `factory.draft_${action}`,
      entity_type: "draft",
      entity_id: id,
      payload: { from: current.status, to: draft.status, version: draft.version },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return errorResponse(error);
  }
}
