import { NextResponse } from "next/server";
import { loadLiveBundle } from "@/lib/live";
import {
  OperatorAuthError,
  requireOperator,
} from "@/lib/auth/operator-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireOperator();
    const data = await loadLiveBundle();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof OperatorAuthError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "live_load_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
