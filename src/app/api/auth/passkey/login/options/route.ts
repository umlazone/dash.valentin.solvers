import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import { buildAuthenticationOptions } from "@/lib/auth/webauthn";
import { createWebAuthnStore } from "@/lib/auth/webauthn-store";
import { hashRequestIp } from "@/lib/auth/otp";
import { trustedClientIp } from "@/lib/auth/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const store = createWebAuthnStore(client);
    const options = await buildAuthenticationOptions(
      {
        rpName: config.webAuthnRpName,
        rpId: config.webAuthnRpId,
        origin: config.webAuthnOrigin,
      },
      [],
    );
    const challengeId = crypto.randomUUID();
    const now = new Date();
    const ipHash = hashRequestIp(
      trustedClientIp(request.headers),
      config.authSecret,
    );
    const reserved = await store.reserveLoginChallenge({
      id: challengeId,
      challenge: options.challenge,
      ipHash,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      now: now.toISOString(),
    });
    if (!reserved) {
      return NextResponse.json(
        { error: "Passkey login rate limited" },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: true, challengeId, options });
  } catch {
    return NextResponse.json(
      { error: "Passkey login unavailable" },
      { status: 500 },
    );
  }
}
