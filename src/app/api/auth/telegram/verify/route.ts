import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { readAuthConfig } from "@/lib/auth/config";
import { OtpFlowError, verifyTelegramOtp } from "@/lib/auth/otp-service";
import { createSupabaseOtpRepository } from "@/lib/auth/supabase-otp-repository";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challengeId?: unknown;
      code?: unknown;
    };
    if (
      typeof body.challengeId !== "string" ||
      typeof body.code !== "string" ||
      !/^\d{6}$/u.test(body.code)
    ) {
      return NextResponse.json(
        { error: "Código inválido o vencido." },
        { status: 400 },
      );
    }
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const session = await verifyTelegramOtp({
      repository: createSupabaseOtpRepository(client),
      secret: config.authSecret,
      challengeId: body.challengeId,
      code: body.code,
    });
    const now = Math.floor(Date.now() / 1000);
    const token = await createSessionToken(
      {
        sid: session.sessionId,
        factor: session.factor,
        now,
        ttl: SESSION_TTL_SECONDS,
      },
      config.authSecret,
    );
    const response = NextResponse.json({
      ok: true,
      needsPasskey: true,
      passkeyEnrollmentExpiresIn: 600,
    });
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(SESSION_TTL_SECONDS),
    );
    return response;
  } catch (error) {
    if (error instanceof OtpFlowError) {
      return NextResponse.json(
        { error: "Código inválido o vencido." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo validar el acceso." },
      { status: 500 },
    );
  }
}
