import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthFactor } from "@/lib/auth/session-token";

export type PasskeyRow = {
  id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  device_type: string | null;
  backed_up: boolean;
};

export function createWebAuthnStore(client: SupabaseClient) {
  return {
    async listPasskeys(): Promise<PasskeyRow[]> {
      const { data, error } = await client
        .from("mc_passkeys")
        .select(
          "id,credential_id,public_key,counter,transports,device_type,backed_up",
        )
        .order("created_at", { ascending: true });
      if (error) throw new Error("Passkey lookup failed");
      return (data || []) as PasskeyRow[];
    },

    async findPasskey(credentialId: string): Promise<PasskeyRow | null> {
      const { data, error } = await client
        .from("mc_passkeys")
        .select(
          "id,credential_id,public_key,counter,transports,device_type,backed_up",
        )
        .eq("credential_id", credentialId)
        .maybeSingle();
      if (error) throw new Error("Passkey lookup failed");
      return data as PasskeyRow | null;
    },

    async createChallenge(input: {
      id: string;
      kind: "passkey_register" | "passkey_login";
      challenge: string;
      expiresAt: string;
      metadata?: Record<string, unknown>;
    }) {
      const { error } = await client.from("mc_auth_challenges").insert({
        id: input.id,
        kind: input.kind,
        challenge: input.challenge,
        expires_at: input.expiresAt,
        metadata: input.metadata || {},
      });
      if (error) throw new Error("Passkey challenge creation failed");
    },

    async consumeChallenge(
      id: string,
      kind: "passkey_register" | "passkey_login",
      now = new Date(),
    ): Promise<{ challenge: string; metadata: Record<string, unknown> } | null> {
      const { data, error } = await client.rpc(
        "mc_consume_webauthn_challenge",
        {
          p_id: id,
          p_kind: kind,
          p_now: now.toISOString(),
        },
      );
      if (error) throw new Error("Passkey challenge verification failed");
      if (!data || typeof data.challenge !== "string") return null;
      return {
        challenge: data.challenge,
        metadata:
          data.metadata && typeof data.metadata === "object"
            ? data.metadata
            : {},
      };
    },

    async findEnrollmentGrant(sessionId: string) {
      const { data, error } = await client
        .from("mc_enrollment_grants")
        .select("id,expires_at")
        .eq("session_id", sessionId)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error("Enrollment grant lookup failed");
      return data as { id: string; expires_at: string } | null;
    },

    async storePasskeyWithGrant(input: {
      grantId: string;
      sessionId: string;
      credentialId: string;
      publicKey: string;
      counter: number;
      transports: string[];
      deviceType: string;
      backedUp: boolean;
    }) {
      const { data, error } = await client.rpc("mc_store_passkey_with_grant", {
        p_grant_id: input.grantId,
        p_session_id: input.sessionId,
        p_credential_id: input.credentialId,
        p_public_key: input.publicKey,
        p_counter: input.counter,
        p_transports: input.transports,
        p_device_type: input.deviceType,
        p_backed_up: input.backedUp,
        p_now: new Date().toISOString(),
      });
      if (error) throw new Error("Passkey storage failed");
      return data === true;
    },

    async reserveLoginChallenge(input: {
      id: string;
      challenge: string;
      ipHash: string;
      expiresAt: string;
      now: string;
    }) {
      const { data, error } = await client.rpc(
        "mc_reserve_webauthn_login_challenge",
        {
          p_id: input.id,
          p_challenge: input.challenge,
          p_ip_hash: input.ipHash,
          p_expires_at: input.expiresAt,
          p_now: input.now,
        },
      );
      if (error) throw new Error("Passkey challenge creation failed");
      return data === true;
    },

    async updatePasskey(input: {
      credentialId: string;
      oldCounter: number;
      newCounter: number;
      deviceType: string;
      backedUp: boolean;
    }) {
      const { data, error } = await client.rpc("mc_update_passkey_counter", {
        p_credential_id: input.credentialId,
        p_old_counter: input.oldCounter,
        p_new_counter: input.newCounter,
        p_device_type: input.deviceType,
        p_backed_up: input.backedUp,
        p_now: new Date().toISOString(),
      });
      if (error) throw new Error("Passkey counter update failed");
      return data === true;
    },

    async createSession(input: {
      id: string;
      factor: AuthFactor;
      expiresAt: string;
    }) {
      const { error } = await client.from("mc_sessions").insert({
        id: input.id,
        factor: input.factor,
        expires_at: input.expiresAt,
      });
      if (error) throw new Error("Session creation failed");
    },

    async addEvent(eventType: string, payload: Record<string, unknown> = {}) {
      const { error } = await client.from("mc_events").insert({
        event_type: eventType,
        entity_type: "auth",
        payload,
      });
      if (error) throw new Error("Audit event creation failed");
    },
  };
}
