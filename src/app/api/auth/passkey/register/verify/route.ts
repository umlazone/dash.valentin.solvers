import { NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import {
  OperatorAuthError,
  requireOperator,
} from "@/lib/auth/operator-session";
import {
  encodePublicKey,
  REGISTRATION_REQUIRE_USER_VERIFICATION,
} from "@/lib/auth/webauthn";
import { createWebAuthnStore } from "@/lib/auth/webauthn-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireOperator();
    if (session.factor !== "telegram_otp") {
      return NextResponse.json(
        { error: "Telegram verification required" },
        { status: 403 },
      );
    }
    const body = (await request.json()) as {
      challengeId?: unknown;
      response?: RegistrationResponseJSON;
    };
    if (typeof body.challengeId !== "string" || !body.response) {
      return NextResponse.json({ error: "Invalid passkey response" }, { status: 400 });
    }
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const store = createWebAuthnStore(client);
    const savedChallenge = await store.consumeChallenge(
      body.challengeId,
      "passkey_register",
    );
    if (
      !savedChallenge ||
      savedChallenge.metadata.sessionId !== session.sid
    ) {
      return NextResponse.json(
        { error: "Passkey challenge expired" },
        { status: 401 },
      );
    }
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: savedChallenge.challenge,
      expectedOrigin: config.webAuthnOrigin,
      expectedRPID: config.webAuthnRpId,
      requireUserVerification: REGISTRATION_REQUIRE_USER_VERIFICATION,
    });
    if (!verification.verified) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 401 },
      );
    }
    const info = verification.registrationInfo;
    await store.savePasskey({
      credentialId: info.credential.id,
      publicKey: encodePublicKey(info.credential.publicKey),
      counter: info.credential.counter,
      transports: info.credential.transports || [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
    await store.addEvent("auth.passkey_registered", {
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof OperatorAuthError ? 401 : 400;
    return NextResponse.json(
      { error: status === 401 ? "unauthorized" : "Passkey registration failed" },
      { status },
    );
  }
}
