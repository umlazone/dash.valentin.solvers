import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
  type Base64URLString,
} from "@simplewebauthn/server";

export type WebAuthnConfig = {
  rpName: string;
  rpId: string;
  origin: string;
};

export type StoredCredentialDescriptor = {
  id: string;
  transports?: string[];
};

function transports(values?: string[]) {
  return values as AuthenticatorTransportFuture[] | undefined;
}

export async function buildRegistrationOptions(
  config: WebAuthnConfig,
  existing: StoredCredentialDescriptor[],
) {
  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: "valentin",
    userID: new TextEncoder().encode("solvers-operator-valentin"),
    userDisplayName: "Valentin · Solvers",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    preferredAuthenticatorType: "localDevice",
    excludeCredentials: existing.map((credential) => ({
      id: credential.id as Base64URLString,
      transports: transports(credential.transports),
    })),
  });
}

export async function buildAuthenticationOptions(
  config: WebAuthnConfig,
  credentials: StoredCredentialDescriptor[],
) {
  return generateAuthenticationOptions({
    rpID: config.rpId,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.id as Base64URLString,
      transports: transports(credential.transports),
    })),
  });
}

export function encodePublicKey(key: Uint8Array) {
  return Buffer.from(key).toString("base64url");
}

export function decodePublicKey(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
