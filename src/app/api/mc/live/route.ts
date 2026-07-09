import { NextResponse } from "next/server";
import { loadLiveBundle } from "@/lib/live";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await loadLiveBundle();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "live_load_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
