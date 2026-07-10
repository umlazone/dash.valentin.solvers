import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseService } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session-token";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const secret = process.env.MC_AUTH_SECRET;
  const client = getSupabaseService();
  if (token && secret && client) {
    const payload = await verifySessionToken(token, secret);
    if (payload) {
      await client
        .from("mc_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", payload.sid);
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
