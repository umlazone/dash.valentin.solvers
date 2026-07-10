import { NextResponse } from "next/server";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type Base64URLString,
} from "@simplewebauthn/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session-token";
import { decodePublicKey } from "@/lib/auth/webauthn";
import { createWebAuthnStore } from "@/lib/auth/webauthn-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challengeId?: unknown;
      response?: AuthenticationResponseJSON;
    };
    if (typeof body.challengeId !== "string" || !body.response?.id) {
      return NextResponse.json({ error: "Invalid passkey response" }, { status: 400 });
    }
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const store = createWebAuthnStore(client);
    const savedChallenge = await store.consumeChallenge(
      body.challengeId,
      "passkey_login",
    );
    if (!savedChallenge) {
      return NextResponse.json(
        { error: "Passkey challenge expired" },
        { status: 401 },
      );
    }
    const passkey = await store.findPasskey(body.response.id);
    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 401 },
      );
    }
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: savedChallenge.challenge,
      expectedOrigin: config.webAuthnOrigin,
      expectedRPID: config.webAuthnRpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credential_id as Base64URLString,
        publicKey: decodePublicKey(passkey.public_key),
        counter: Number(passkey.counter),
        transports: (passkey.transports || []) as AuthenticatorTransportFuture[],
      },
    });
    if (!verification.verified || !verification.authenticationInfo.userVerified) {
      return NextResponse.json(
        { error: "Passkey verification failed" },
        { status: 401 },
      );
    }
    const info = verification.authenticationInfo;
    await store.updatePasskey({
      credentialId: passkey.credential_id,
      counter: info.newCounter,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await store.createSession({
      id: sessionId,
      factor: "passkey",
      expiresAt: new Date((now + SESSION_TTL_SECONDS) * 1000).toISOString(),
    });
    await store.addEvent("auth.passkey_login", {
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
    const token = await createSessionToken(
      { sid: sessionId, factor: "passkey", now, ttl: SESSION_TTL_SECONDS },
      config.authSecret,
    );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(SESSION_TTL_SECONDS),
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "Passkey verification failed" },
      { status: 401 },
    );
  }
}
