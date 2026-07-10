import type { SessionPayload } from "@/lib/auth/session-token";
import {
  isSessionRecordActive,
  type SessionRecord,
} from "@/lib/auth/session-store";

type MiddlewareSessionConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type Fetcher = typeof fetch;

export async function verifyMiddlewareSession(
  payload: SessionPayload,
  config: MiddlewareSessionConfig,
  fetcher: Fetcher = fetch,
  now = new Date(),
) {
  try {
    const url = new URL("/rest/v1/mc_sessions", config.supabaseUrl);
    url.searchParams.set(
      "select",
      "id,factor,expires_at,revoked_at",
    );
    url.searchParams.set("id", `eq.${payload.sid}`);
    url.searchParams.set("limit", "1");
    const response = await fetcher(url, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const rows = (await response.json()) as SessionRecord[];
    const record = rows[0];
    return record
      ? isSessionRecordActive(
          record,
          payload.sid,
          payload.factor,
          now,
        )
      : false;
  } catch {
    return false;
  }
}
