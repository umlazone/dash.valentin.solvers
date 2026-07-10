import type { SupabaseClient } from "@supabase/supabase-js";
import type { OtpRepository } from "@/lib/auth/otp-service";

export function createSupabaseOtpRepository(
  client: SupabaseClient,
): OtpRepository {
  return {
    async reserveChallenge(input) {
      const { data, error } = await client.rpc("mc_reserve_otp_challenge", {
        p_id: input.id,
        p_code_hash: input.codeHash,
        p_ip_hash: input.ipHash,
        p_expires_at: input.expiresAt,
        p_now: input.now,
      });
      if (error) throw new Error("OTP reservation failed");
      return data === true;
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

    async createSessionWithEnrollmentGrant(input) {
      const { data, error } = await client.rpc(
        "mc_create_otp_session_with_grant",
        {
          p_session_id: input.id,
          p_session_expires_at: input.expiresAt,
          p_grant_id: input.enrollmentGrant.id,
          p_grant_expires_at: input.enrollmentGrant.expiresAt,
        },
      );
      if (error || data !== true) throw new Error("Session creation failed");
    },
  };
}
