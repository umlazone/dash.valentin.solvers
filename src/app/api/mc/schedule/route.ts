import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";
import { parseScheduleInput } from "@/lib/factory/validators";
import {
  assertDraftTransition,
  buildPublicationIntent,
  type DraftWorkflowStatus,
} from "@/lib/factory/workflow";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireOperator();
    const now = new Date();
    const input = parseScheduleInput(await request.json(), now);
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const { data: draft, error: lookupError } = await client
      .from("mc_drafts")
      .select("id,status,approved_at,body,version")
      .eq("id", input.draftId)
      .maybeSingle();
    if (lookupError) throw new Error(`draft_lookup_failed:${lookupError.message}`);
    if (!draft) return NextResponse.json({ error: "draft_not_found" }, { status: 404 });
    assertDraftTransition(draft.status as DraftWorkflowStatus, "scheduled", {
      body: draft.body,
      scheduledFor: input.scheduledFor,
      now,
    });
    if (!draft.approved_at) throw new Error("human_approval_required");
    const intent = buildPublicationIntent({
      draftId: draft.id,
      version: Number(draft.version || 1),
      body: draft.body,
      scheduledFor: input.scheduledFor,
    });
    const { data, error } = await client.rpc("mc_schedule_draft", {
      p_draft_id: draft.id,
      p_expected_version: Number(draft.version || 1),
      p_scheduled_for: input.scheduledFor,
      p_content_hash: intent.contentHash,
      p_idempotency_key: intent.idempotencyKey,
      p_now: now.toISOString(),
    });
    if (error) throw new Error(error.message || "schedule_failed");
    return NextResponse.json({ ok: true, publication: data }, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "schedule_failed";
    const bad = [
      "valid_draft_id_required",
      "future_schedule_required",
      "invalid_transition",
      "body_required",
      "human_approval_required",
      "version_conflict",
    ].some((code) => message.includes(code));
    return NextResponse.json({ error: message }, { status: bad ? 400 : 500 });
  }
}
