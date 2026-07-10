import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const allowed = new Set(["new", "shortlisted", "dismissed", "archived"]);

export async function PATCH(request: Request) {
  try {
    await requireOperator();
    const body = (await request.json()) as { id?: string; status?: string };
    if (!body.id || !body.status || !allowed.has(body.status)) {
      return NextResponse.json({ error: "invalid_signal_update" }, { status: 400 });
    }
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    const { data, error } = await client
      .from("mc_signals")
      .update({ status: body.status })
      .eq("id", body.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`signal_update_failed:${error.message}`);
    if (!data) return NextResponse.json({ error: "signal_not_found" }, { status: 404 });
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: `factory.signal_${body.status}`,
      entity_type: "signal",
      entity_id: body.id,
    });
    return NextResponse.json({ ok: true, signal: data });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "signal_update_failed" },
      { status: 500 },
    );
  }
}
