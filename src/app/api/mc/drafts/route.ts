import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import {
  OperatorAuthError,
  requireOperator,
} from "@/lib/auth/operator-session";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    await requireOperator();
    const body = await req.json();
    const id = body?.id as string | undefined;
    const status = body?.status as string | undefined;
    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status required" },
        { status: 400 },
      );
    }
    if (!["pending", "approved", "posted", "rejected"].includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    const sb = getSupabaseService();
    if (!sb) {
      return NextResponse.json(
        { error: "supabase not configured" },
        { status: 503 },
      );
    }

    const { data, error } = await sb
      .from("mc_drafts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, draft: data });
  } catch (e) {
    if (e instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "patch_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
