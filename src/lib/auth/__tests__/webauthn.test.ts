import { describe, expect, it } from "vitest";
import {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  decodePublicKey,
  encodePublicKey,
} from "@/lib/auth/webauthn";

const config = {
  rpName: "Solvers Agency OS",
  rpId: "dashvalentinsolvers.vercel.app",
  origin: "https://dashvalentinsolvers.vercel.app",
};

describe("WebAuthn passkey options", () => {
  it("requires verified local-device registration", async () => {
    const options = await buildRegistrationOptions(config, [
      { id: "existing-credential", transports: ["internal"] },
    ]);

    expect(options.rp.id).toBe(config.rpId);
    expect(options.rp.name).toBe(config.rpName);
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
    expect(options.attestation).toBe("none");
    expect(options.excludeCredentials?.[0]?.id).toBe("existing-credential");
  });

  it("requires user verification for passkey login", async () => {
    const options = await buildAuthenticationOptions(config, [
      { id: "credential-1", transports: ["internal"] },
    ]);

    expect(options.rpId).toBe(config.rpId);
    expect(options.userVerification).toBe("required");
    expect(options.allowCredentials?.[0]?.id).toBe("credential-1");
  });

  it("round-trips a credential public key without data loss", () => {
    const key = Uint8Array.from([0, 1, 2, 127, 128, 254, 255]);

    expect(decodePublicKey(encodePublicKey(key))).toEqual(key);
  });
});
