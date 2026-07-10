import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import { buildAuthenticationOptions } from "@/lib/auth/webauthn";
import { createWebAuthnStore } from "@/lib/auth/webauthn-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const store = createWebAuthnStore(client);
    const passkeys = await store.listPasskeys();
    if (!passkeys.length) {
      return NextResponse.json(
        { error: "No passkey enrolled" },
        { status: 409 },
      );
    }
    const options = await buildAuthenticationOptions(
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
      kind: "passkey_login",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    return NextResponse.json({ ok: true, challengeId, options });
  } catch {
    return NextResponse.json(
      { error: "Passkey login unavailable" },
      { status: 500 },
    );
  }
}
