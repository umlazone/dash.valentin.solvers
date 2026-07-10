import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";
import { buildPublicationIntent } from "@/lib/factory/workflow";
import { validatePublicationDryRun } from "@/lib/factory/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireOperator();
    const body = (await request.json()) as { publicationId?: string };
    if (!body.publicationId) {
      return NextResponse.json({ error: "publication_id_required" }, { status: 400 });
    }
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const { data: publication, error: publicationError } = await client
      .from("mc_publications")
      .select("*")
      .eq("id", body.publicationId)
      .maybeSingle();
    if (publicationError) throw new Error(`publication_lookup_failed:${publicationError.message}`);
    if (!publication) {
      return NextResponse.json({ error: "publication_not_found" }, { status: 404 });
    }
    const { data: draft, error: draftError } = await client
      .from("mc_drafts")
      .select("*")
      .eq("id", publication.draft_id)
      .maybeSingle();
    if (draftError) throw new Error(`draft_lookup_failed:${draftError.message}`);
    if (!draft) return NextResponse.json({ error: "draft_not_found" }, { status: 404 });

    const intent = buildPublicationIntent({
      draftId: draft.id,
      version: Number(publication.draft_version),
      body: publication.content_snapshot,
      scheduledFor: publication.scheduled_for,
    });
    const result = validatePublicationDryRun({
      draftStatus: draft.status,
      approvedAt: draft.approved_at,
      body: publication.content_snapshot,
      contentHashMatches:
        intent.contentHash === publication.content_hash && draft.body === publication.content_snapshot,
      alreadyPublished: Boolean(publication.x_post_id || draft.x_post_id),
    });
    if (!result.ok) {
      await client
        .from("mc_publications")
        .update({ validation: result, error: result.errors.join(",") })
        .eq("id", publication.id);
      await client.from("mc_events").insert({
        actor: "operator",
        event_type: "factory.publication_dry_run_failed",
        entity_type: "publication",
        entity_id: publication.id,
        payload: result,
      });
      return NextResponse.json({ ok: false, validation: result }, { status: 422 });
    }

    const nextCount = Number(publication.dry_run_count || 0) + 1;
    const nextStatus = nextCount >= 3 ? "ready" : "queued";
    const { data: updated, error: updateError } = await client
      .from("mc_publications")
      .update({
        dry_run_count: nextCount,
        status: nextStatus,
        validation: result,
        error: null,
      })
      .eq("id", publication.id)
      .eq("dry_run_count", Number(publication.dry_run_count || 0))
      .select("*")
      .maybeSingle();
    if (updateError) throw new Error(`dry_run_update_failed:${updateError.message}`);
    if (!updated) throw new Error("dry_run_conflict");
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: "factory.publication_dry_run_passed",
      entity_type: "publication",
      entity_id: publication.id,
      payload: { dry_run_count: nextCount, ready: nextStatus === "ready" },
    });
    return NextResponse.json({ ok: true, publication: updated, validation: result });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "dry_run_failed" },
      { status: 500 },
    );
  }
}
