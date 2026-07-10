import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseService } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session-token";

export const runtime = "nodejs";

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const secret = process.env.MC_AUTH_SECRET;
    const client = getSupabaseService();
    if (!token || !secret || !client) {
      return clearSessionCookie(
        NextResponse.json({ ok: false }, { status: 401 }),
      );
    }
    const payload = await verifySessionToken(token, secret);
    if (!payload) {
      return clearSessionCookie(
        NextResponse.json({ ok: false }, { status: 401 }),
      );
    }
    const { data, error } = await client.rpc("mc_revoke_session", {
      p_id: payload.sid,
      p_now: new Date().toISOString(),
    });
    if (error || data !== true) {
      return clearSessionCookie(
        NextResponse.json(
          { ok: false, error: "revocation_failed" },
          { status: 503 },
        ),
      );
    }
    return clearSessionCookie(NextResponse.json({ ok: true }));
  } catch {
    return clearSessionCookie(
      NextResponse.json(
        { ok: false, error: "revocation_failed" },
        { status: 503 },
      ),
    );
  }
}
