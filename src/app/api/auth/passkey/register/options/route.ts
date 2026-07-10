import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import {
  OperatorAuthError,
  requireOperator,
} from "@/lib/auth/operator-session";
import { buildRegistrationOptions } from "@/lib/auth/webauthn";
import { createWebAuthnStore } from "@/lib/auth/webauthn-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireOperator();
    if (session.factor !== "telegram_otp") {
      return NextResponse.json(
        { error: "Telegram verification required" },
        { status: 403 },
      );
    }
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const store = createWebAuthnStore(client);
    const passkeys = await store.listPasskeys();
    const options = await buildRegistrationOptions(
      {
        rpName: config.webAuthnRpName,
        rpId: config.webAuthnRpId,
        origin: config.webAuthnOrigin,
      },
      passkeys.map((key) => ({
        id: key.credential_id,
        transports: key.transports || [],
      })),
    );
    const challengeId = crypto.randomUUID();
    await store.createChallenge({
      id: challengeId,
      kind: "passkey_register",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      metadata: { sessionId: session.sid },
    });
    return NextResponse.json({ ok: true, challengeId, options });
  } catch (error) {
    const status = error instanceof OperatorAuthError ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "unauthorized" : "Passkey setup failed" },
      { status },
    );
  }
}
