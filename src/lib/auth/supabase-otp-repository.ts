import type { SupabaseClient } from "@supabase/supabase-js";
import type { OtpRepository } from "@/lib/auth/otp-service";

export function createSupabaseOtpRepository(
  client: SupabaseClient,
): OtpRepository {
  return {
    async canRequest(ipHash, nowIso) {
      const now = new Date(nowIso);
      const ipWindow = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const [ipResult, latestResult] = await Promise.all([
        client
          .from("mc_auth_challenges")
          .select("id", { count: "exact", head: true })
          .eq("kind", "telegram_otp")
          .eq("ip_hash", ipHash)
          .gte("created_at", ipWindow),
        client
          .from("mc_auth_challenges")
          .select("created_at")
          .eq("kind", "telegram_otp")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (ipResult.error) throw new Error("OTP rate limit lookup failed");
      if (latestResult.error) throw new Error("OTP cooldown lookup failed");
      if ((ipResult.count ?? 0) >= 3) return false;
      const latest = latestResult.data?.created_at
        ? new Date(latestResult.data.created_at).getTime()
        : 0;
      return !latest || now.getTime() - latest >= 30_000;
    },

    async createChallenge(input) {
      const { error } = await client.from("mc_auth_challenges").insert({
        id: input.id,
        kind: "telegram_otp",
        code_hash: input.codeHash,
        expires_at: input.expiresAt,
        ip_hash: input.ipHash,
        created_at: input.createdAt,
      });
      if (error) throw new Error("OTP challenge creation failed");
    },

    async discardChallenge(id) {
      const { error } = await client
        .from("mc_auth_challenges")
        .delete()
        .eq("id", id);
      if (error) throw new Error("OTP challenge cleanup failed");
    },

    async consumeIfValid(input) {
      const { data, error } = await client.rpc("mc_consume_otp", {
        p_id: input.id,
        p_code_hash: input.codeHash,
        p_now: input.now,
      });
      if (error) throw new Error("OTP verification failed");
      return data === true;
    },

    async createSession(input) {
      const { error } = await client.from("mc_sessions").insert({
        id: input.id,
        factor: input.factor,
        expires_at: input.expiresAt,
      });
      if (error) throw new Error("Session creation failed");
    },
  };
}
