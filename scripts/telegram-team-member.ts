#!/usr/bin/env npx tsx

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sendTextMessage } from "../src/lib/telegram/bot";
import {
  activateNotificationMember,
  normalizeNotificationMember,
  notificationMemberKey,
} from "../src/lib/telegram/members";

function loadEnv(path: string) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const split = line.indexOf("=");
      const key = line.slice(0, split).trim();
      let value = line.slice(split + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional local env
  }
}

async function main() {
  const app = resolve(__dirname, "..");
  loadEnv(resolve(app, ".env.local"));
  loadEnv(resolve(homedir(), ".hermes/credentials/solvers-infra.env"));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!url || !key || !botToken) throw new Error("team_member_admin_env_missing");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [command, chatId] = process.argv.slice(2);

  if (command === "list") {
    const { data, error } = await db
      .from("mc_system_settings")
      .select("value,updated_at")
      .like("key", "telegram_notification_member:%")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`team_member_list_failed:${error.message}`);
    const members = (data || [])
      .map((row) => normalizeNotificationMember(row.value))
      .filter((member) => member !== null)
      .map((member) => ({
        chatId: member.chatId,
        firstName: member.firstName || null,
        username: member.username || null,
        status: member.status,
        requestedAt: member.requestedAt,
        activatedAt: member.activatedAt || null,
      }));
    console.log(JSON.stringify({ ok: true, members }, null, 2));
    return;
  }

  if (command !== "activate" || !chatId) {
    throw new Error("usage: telegram-team-member.ts list | activate <chat_id>");
  }

  const settingKey = notificationMemberKey(chatId);
  const { data: row, error: lookupError } = await db
    .from("mc_system_settings")
    .select("value")
    .eq("key", settingKey)
    .maybeSingle();
  if (lookupError) throw new Error(`team_member_lookup_failed:${lookupError.message}`);
  const current = normalizeNotificationMember(row?.value);
  if (!current) throw new Error("team_member_request_not_found");

  let active = current;
  if (current.status === "pending") {
    const next = activateNotificationMember(current, {
      now: new Date().toISOString(),
      activatedBy: "operator_local",
    });
    const { data, error } = await db
      .from("mc_system_settings")
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq("key", settingKey)
      .eq("value->>status", "pending")
      .select("value")
      .maybeSingle();
    if (error) throw new Error(`team_member_activate_failed:${error.message}`);
    active = normalizeNotificationMember(data?.value) || current;
    if (active.status !== "active") throw new Error("team_member_activate_conflict");
  } else if (current.status !== "active") {
    throw new Error("team_member_not_pending");
  }

  const { data: existingEvent, error: eventLookupError } = await db
    .from("mc_events")
    .select("id")
    .eq("event_type", "factory.telegram_team_access_activated_local")
    .eq("entity_id", chatId)
    .limit(1)
    .maybeSingle();
  if (eventLookupError) throw new Error(`team_member_event_lookup_failed:${eventLookupError.message}`);
  if (!existingEvent) {
    const { error } = await db.from("mc_events").insert({
      actor: "operator_local",
      event_type: "factory.telegram_team_access_activated_local",
      entity_type: "telegram_chat",
      entity_id: chatId,
      payload: { access: "read_only" },
    });
    if (error) throw new Error(`team_member_event_failed:${error.message}`);
  }

  await sendTextMessage(
    { botToken, chatId },
    "✅ Tu acceso de equipo a Solvers Notifications está activo. Usa /status para ver el estado operativo. Es un acceso de solo lectura.",
  );
  console.log(JSON.stringify({ ok: true, chatId, status: "active" }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "team_member_admin_failed");
  process.exitCode = 1;
});
