import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseService } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/auth/session-token";
import { isSessionRecordActive } from "@/lib/auth/session-store";

export class OperatorAuthError extends Error {
  constructor() {
    super("Operator authentication required");
    this.name = "OperatorAuthError";
  }
}

export async function validateOperatorToken(
  token: string | undefined,
  client: SupabaseClient,
  secret: string,
  now = new Date(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const payload = await verifySessionToken(
    token,
    secret,
    Math.floor(now.getTime() / 1000),
  );
  if (!payload) return null;
  const { data, error } = await client
    .from("mc_sessions")
    .select("id,factor,expires_at,revoked_at")
    .eq("id", payload.sid)
    .maybeSingle();
  if (error || !isSessionRecordActive(data, payload.sid, payload.factor, now)) {
    return null;
  }
  return payload;
}

export async function requireOperator() {
  const secret = process.env.MC_AUTH_SECRET;
  const client = getSupabaseService();
  if (!secret || !client) throw new OperatorAuthError();
  const store = await cookies();
  const payload = await validateOperatorToken(
    store.get(SESSION_COOKIE)?.value,
    client,
    secret,
  );
  if (!payload) throw new OperatorAuthError();
  return payload;
}
