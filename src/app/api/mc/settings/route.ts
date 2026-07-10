import { NextResponse } from "next/server";
import { OperatorAuthError, requireOperator } from "@/lib/auth/operator-session";
import { getSupabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const allowed = new Set([
  "research_enabled",
  "research_cadence_hours",
  "publisher_mode",
  "publisher_enabled",
  "kill_switch",
  "daily_publish_limit",
]);

export async function PATCH(request: Request) {
  try {
    await requireOperator();
    const body = (await request.json()) as { key?: string; value?: unknown };
    if (!body.key || !allowed.has(body.key)) {
      return NextResponse.json({ error: "invalid_setting" }, { status: 400 });
    }
    if (body.key === "publisher_mode" && !["dry_run", "live"].includes(String(body.value))) {
      return NextResponse.json({ error: "invalid_publisher_mode" }, { status: 400 });
    }
    if (body.key === "research_cadence_hours") {
      const cadence = Number(body.value);
      if (!Number.isInteger(cadence) || cadence < 1 || cadence > 24) {
        return NextResponse.json({ error: "invalid_research_cadence" }, { status: 400 });
      }
    }
    if (body.key === "daily_publish_limit") {
      const limit = Number(body.value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
        return NextResponse.json({ error: "invalid_daily_limit" }, { status: 400 });
      }
    }
    const client = getSupabaseService();
    if (!client) throw new Error("supabase_not_configured");
    if (body.key === "publisher_enabled" && body.value === true) {
      const [{ data: mode }, { count: readyCount }] = await Promise.all([
        client.from("mc_system_settings").select("value").eq("key", "publisher_mode").maybeSingle(),
        client
          .from("mc_publications")
          .select("id", { head: true, count: "exact" })
          .gte("dry_run_count", 3),
      ]);
      if (mode?.value !== "live" || (readyCount || 0) < 1) {
        return NextResponse.json({ error: "publisher_launch_gate_not_met" }, { status: 409 });
      }
    }
    const { data, error } = await client
      .from("mc_system_settings")
      .update({ value: body.value })
      .eq("key", body.key)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`setting_update_failed:${error.message}`);
    if (!data) return NextResponse.json({ error: "setting_not_found" }, { status: 404 });
    await client.from("mc_events").insert({
      actor: "operator",
      event_type: "factory.setting_updated",
      entity_type: "setting",
      entity_id: body.key,
      payload: { value: body.value },
    });
    return NextResponse.json({ ok: true, setting: data });
  } catch (error) {
    if (error instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "setting_update_failed" },
      { status: 500 },
    );
  }
}
