export const SESSION_COOKIE = "mc_session";
export type AuthFactor = "telegram_otp" | "passkey";

export type SessionPayload = {
  version: 1;
  sid: string;
  factor: AuthFactor;
  iat: number;
  exp: number;
};

type CreateSessionInput = {
  sid: string;
  factor: AuthFactor;
  now: number;
  ttl: number;
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  input: CreateSessionInput,
  secret: string,
) {
  const payload: SessionPayload = {
    version: 1,
    sid: input.sid,
    factor: input.factor,
    iat: input.now,
    exp: input.now + input.ttl,
  };
  const encoded = toBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  try {
    const [encoded, signatureValue, extra] = token.split(".");
    if (!encoded || !signatureValue || extra) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signatureValue),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encoded)),
    ) as SessionPayload;
    if (
      payload.version !== 1 ||
      !payload.sid ||
      !["telegram_otp", "passkey"].includes(payload.factor) ||
      !Number.isFinite(payload.iat) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      payload.iat > now + 60
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
