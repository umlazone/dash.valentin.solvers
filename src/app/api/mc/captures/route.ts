import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";
import { parseCaptureInput } from "@/lib/factory/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireOperator();
    const input = parseCaptureInput(await request.json());
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const { data, error } = await client
      .from("mc_captures")
      .insert({
        title: input.title,
        raw_text: input.rawText,
        capture_type: input.captureType,
        source_type: input.sourceType,
        source_ref: input.sourceRef,
        language: input.language,
        area: input.area,
        tags: input.tags,
        priority: input.priority,
      })
      .select("*")
      .single();
    if (error) throw new Error(`capture_create_failed:${error.message}`);
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: "factory.capture_created",
      entity_type: "capture",
      entity_id: data.id,
      payload: { capture_type: input.captureType, language: input.language },
    });
    return NextResponse.json({ ok: true, capture: data }, { status: 201 });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "capture_create_failed";
    const badInput = [
      "capture_content_required",
      "capture_too_long",
      "invalid_capture_type",
    ].includes(message);
    return NextResponse.json({ error: message }, { status: badInput ? 400 : 500 });
  }
}
