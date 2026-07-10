import { NextResponse } from "next/server";
import { getSupabaseService } from "@/lib/supabase";
import { hashRequestIdentity } from "@/lib/auth/otp";
import { readAuthConfig } from "@/lib/auth/config";
import {
  OtpFlowError,
  requestTelegramOtp,
} from "@/lib/auth/otp-service";
import { createSupabaseOtpRepository } from "@/lib/auth/supabase-otp-repository";
import { sendTelegramOtp } from "@/lib/auth/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readAuthConfig();
    const client = getSupabaseService();
    if (!client) throw new Error("Supabase service unavailable");
    const forwarded = request.headers.get("x-forwarded-for") || "unknown";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";
    const agent = request.headers.get("user-agent") || "unknown";
    const ipHash = hashRequestIdentity(ip, agent, config.authSecret);
    const result = await requestTelegramOtp({
      repository: createSupabaseOtpRepository(client),
      send: (code) => sendTelegramOtp(config, code),
      secret: config.authSecret,
      ipHash,
    });
    return NextResponse.json({ ok: true, challengeId: result.challengeId });
  } catch (error) {
    if (error instanceof OtpFlowError && error.code === "rate_limited") {
      return NextResponse.json(
        { error: "Espera un momento antes de solicitar otro código." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "No se pudo enviar el código de acceso." },
      { status: 502 },
    );
  }
}
