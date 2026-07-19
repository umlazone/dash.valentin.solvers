#!/usr/bin/env npx tsx

/**
 * Hourly media/trends brief → 1–2 human post proposals → OTP Telegram bot
 * with inline Approve / Decline buttons.
 *
 * Isolation:
 * - Grok child only gets x_search + stripped env
 * - Telegram/Supabase secrets stay in this parent process
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractResearchEnvelope } from "../src/lib/factory/research-output";
import { buildEditorialLearningSnapshot } from "../src/lib/factory/editorial-learning";
import {
  buildHourlyBriefPrompt,
  buildHourlyXurlQueries,
  parseHourlyBrief,
} from "../src/lib/factory/hourly-brief";
import {
  appendDeterministicXContext,
  buildFallbackHermesArgs,
  isXaiCreditFailure,
  parseCreatorHandles,
  parseXurlSearchContext,
} from "../src/lib/factory/research-runner";
import {
  editProposalResult,
  enableProposalControls,
  sendDraftProposal,
} from "../src/lib/telegram/bot";
import { formatProposalMessage } from "../src/lib/telegram/approval";
import {
  activeNotificationChatIds,
  formatTelegramDecisionLine,
  missingTelegramApprovalChatIds,
  normalizeTelegramApprovalMessages,
} from "../src/lib/telegram/members";

process.umask(0o077);

const ROOT = "/Users/kin/solvers-x-engine";
const APP = `${ROOT}/apps/dash.valentin.solvers`;
const OUT = "/tmp/solvers-hourly-brief.json";
const OUT_TMP = `${OUT}.${process.pid}.tmp`;
const HERMES = process.env.HERMES_BIN || "hermes";
const HOURLY_XURL_QUERIES = [
  '("AI agent" OR agentic) (production OR reliability OR workflow) -is:retweet -is:reply lang:en',
  '("AI agency" OR "agent ops" OR "agentic coding") -is:retweet -is:reply lang:en',
  '("agentes de IA" OR "agentes IA") (automatización OR operaciones OR negocio) -is:retweet -is:reply lang:es',
];

function collectHourlyXContext(creatorHandles: string[]) {
  const records = buildHourlyXurlQueries(creatorHandles, HOURLY_XURL_QUERIES).flatMap((query) => {
    try {
      const raw = execFileSync("xurl", ["search", query, "-n", "10"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 500_000,
      });
      return parseXurlSearchContext(raw);
    } catch {
      return [];
    }
  });
  return Array.from(new Map(records.map((record) => [record.sourcePostId, record])).values());
}

function loadEnv(path: string) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/u)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function childEnv(): NodeJS.ProcessEnv {
  const keep = ["HOME", "PATH", "LANG", "LC_ALL", "TMPDIR", "USER", "SHELL", "HERMES_HOME"];
  return {
    NODE_ENV: "production",
    ...Object.fromEntries(
      keep.flatMap((k) => (process.env[k] ? [[k, process.env[k] as string]] : [])),
    ),
  };
}

function dateWindow() {
  const to = new Date();
  const from = new Date(to.getTime() - 36 * 60 * 60 * 1000);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

type DbClient = SupabaseClient;
type ProposalCopy = {
  id: string;
  version: number;
  title: string;
  body: string;
  language: "ES" | "EN";
  angle?: string;
};

type ProposalDraftRow = Omit<ProposalCopy, "angle"> & {
  hook?: string | null;
  status: string;
  metadata: unknown;
  scheduled_for?: string | null;
};

function isNotModified(error: unknown) {
  return error instanceof Error && error.message.includes("message is not modified");
}

async function applyRegisteredProposalState(input: {
  botToken: string;
  chatId: string;
  messageId: number;
  proposal: ProposalCopy;
  registration: unknown;
}) {
  const state = input.registration && typeof input.registration === "object"
    ? input.registration as Record<string, unknown>
    : {};
  const proposalText = formatProposalMessage(input.proposal);
  if (["approve", "decline"].includes(String(state.decision))) {
    await editProposalResult(
      { botToken: input.botToken, chatId: input.chatId },
      input.messageId,
      proposalText,
      formatTelegramDecisionLine({
        decision: state.decision as "approve" | "decline",
        scheduledFor: typeof state.scheduled_for === "string" ? state.scheduled_for : null,
        actor: state.decided_by,
      }),
    );
    return "terminal" as const;
  }
  if (state.registered === true) {
    await enableProposalControls(
      { botToken: input.botToken, chatId: input.chatId },
      input.messageId,
      input.proposal.id,
      input.proposal.version,
    );
    return "active" as const;
  }
  await editProposalResult(
    { botToken: input.botToken, chatId: input.chatId },
    input.messageId,
    proposalText,
    "⚠️ PROPUESTA DESACTUALIZADA · espera la versión nueva",
  );
  return "stale" as const;
}

async function sendAndRegisterProposalCopy(input: {
  db: DbClient;
  botToken: string;
  chatId: string;
  proposal: ProposalCopy;
}) {
  const sent = await sendDraftProposal(
    { botToken: input.botToken, chatId: input.chatId },
    input.proposal,
    { withControls: false },
  );
  if (!sent.messageId) throw new Error("telegram_message_id_missing");
  const { data: registration, error } = await input.db.rpc(
    "mc_register_telegram_approval_message",
    {
      p_draft_id: input.proposal.id,
      p_draft_version: input.proposal.version,
      p_chat_id: input.chatId,
      p_message_id: sent.messageId,
      p_now: new Date().toISOString(),
    },
  );
  if (error) throw new Error(`telegram_message_register_failed:${error.message}`);
  return applyRegisteredProposalState({
    botToken: input.botToken,
    chatId: input.chatId,
    messageId: sent.messageId,
    proposal: input.proposal,
    registration,
  });
}

async function reconcileTelegramProposals(input: {
  db: DbClient;
  botToken: string;
  recipientChatIds: string[];
}) {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await input.db
    .from("mc_drafts")
    .select("id,version,title,body,language,hook,status,metadata,scheduled_for,updated_at")
    .eq("source", "hourly_brief")
    .contains("metadata", { telegram_shared_delivery: true })
    .in("status", ["in_review", "scheduled", "publishing", "published", "failed", "rejected"])
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`telegram_reconcile_lookup_failed:${error.message}`);

  const failures: Array<{ draftId: string; chatId: string; error: string }> = [];
  for (const row of (data || []) as ProposalDraftRow[]) {
    const proposal: ProposalCopy = {
      id: row.id,
      version: Number(row.version),
      title: row.title,
      body: row.body,
      language: row.language === "EN" ? "EN" : "ES",
      angle: row.hook || undefined,
    };
    const text = formatProposalMessage(proposal);
    const mappings = normalizeTelegramApprovalMessages(row.metadata);
    const decision = ["scheduled", "publishing", "published", "failed"].includes(row.status)
      ? "approve"
      : row.status === "rejected"
        ? "decline"
        : null;

    if (decision) {
      const metadata = row.metadata && typeof row.metadata === "object"
        ? row.metadata as Record<string, unknown>
        : {};
      for (const mapping of mappings) {
        try {
          await editProposalResult(
            { botToken: input.botToken, chatId: mapping.chatId },
            mapping.messageId,
            text,
            formatTelegramDecisionLine({
              decision,
              scheduledFor: row.scheduled_for,
              actor: metadata.telegram_decided_by,
            }),
          );
        } catch (syncError) {
          if (!isNotModified(syncError)) {
            failures.push({
              draftId: row.id,
              chatId: mapping.chatId,
              error: syncError instanceof Error ? syncError.message.slice(0, 240) : "sync_failed",
            });
          }
        }
      }
      for (const recipientChatId of missingTelegramApprovalChatIds(mappings, input.recipientChatIds)) {
        try {
          await sendAndRegisterProposalCopy({
            db: input.db,
            botToken: input.botToken,
            chatId: recipientChatId,
            proposal,
          });
        } catch (deliveryError) {
          failures.push({
            draftId: row.id,
            chatId: recipientChatId,
            error: deliveryError instanceof Error ? deliveryError.message.slice(0, 240) : "terminal_delivery_failed",
          });
        }
      }
      continue;
    }

    for (const recipientChatId of input.recipientChatIds) {
      const mapping = mappings.find((item) => item.chatId === recipientChatId);
      try {
        if (mapping?.draftVersion === proposal.version) {
          await enableProposalControls(
            { botToken: input.botToken, chatId: recipientChatId },
            mapping.messageId,
            proposal.id,
            proposal.version,
          );
          continue;
        }
        if (mapping) {
          try {
            await editProposalResult(
              { botToken: input.botToken, chatId: recipientChatId },
              mapping.messageId,
              text,
              "⚠️ PROPUESTA DESACTUALIZADA · reemplazada por una versión nueva",
            );
          } catch (staleError) {
            if (!isNotModified(staleError)) throw staleError;
          }
        }
        await sendAndRegisterProposalCopy({
          db: input.db,
          botToken: input.botToken,
          chatId: recipientChatId,
          proposal,
        });
      } catch (deliveryError) {
        if (!isNotModified(deliveryError)) {
          failures.push({
            draftId: row.id,
            chatId: recipientChatId,
            error: deliveryError instanceof Error ? deliveryError.message.slice(0, 240) : "delivery_failed",
          });
        }
      }
    }
  }
  if (failures.length) {
    await input.db.from("mc_events").insert({
      actor: "telegram_reconciler",
      event_type: "factory.telegram_reconciliation_incomplete",
      entity_type: "system",
      entity_id: "solvers_notifications",
      payload: { failures },
    });
  }
  return failures;
}

async function main() {
  loadEnv(resolve(APP, ".env.local"));
  loadEnv(resolve(homedir(), ".hermes/credentials/solvers-infra.env"));

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!url || !key || !botToken || !chatId) throw new Error("hourly_brief_env_missing");

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: memberRows, error: memberError } = await db
    .from("mc_system_settings")
    .select("value")
    .like("key", "telegram_notification_member:%");
  if (memberError) throw new Error(`telegram_members_failed:${memberError.message}`);
  const recipientChatIds = activeNotificationChatIds(memberRows || [], chatId);
  const reconciliationFailures = await reconcileTelegramProposals({
    db,
    botToken,
    recipientChatIds,
  });

  const [draftsResult, publicationsResult, metricsResult] = await Promise.all([
    db
      .from("mc_drafts")
      .select("id,title,hook,body,status,content_type,change_request,quality_checks,metadata,updated_at")
      .order("updated_at", { ascending: false })
      .limit(80),
    db
      .from("mc_publications")
      .select("id,draft_id,status,content_snapshot,published_at")
      .order("updated_at", { ascending: false })
      .limit(60),
    db
      .from("mc_post_metrics")
      .select("publication_id,window_label,impressions,likes,replies,reposts,quotes,bookmarks,profile_clicks,url_clicks,captured_at")
      .order("captured_at", { ascending: false })
      .limit(120),
  ]);
  for (const result of [draftsResult, publicationsResult, metricsResult]) {
    if (result.error) throw new Error(`hourly_learning_context_failed:${result.error.message}`);
  }
  const drafts = draftsResult.data || [];
  const titles = drafts.map((draft) => String(draft.title || "")).filter(Boolean);
  const editorialLearning = buildEditorialLearningSnapshot({
    drafts,
    publications: publicationsResult.data || [],
    metrics: metricsResult.data || [],
  });
  const creatorContext = readFileSync(resolve(ROOT, "scouts/creators.yaml"), "utf8");
  const creatorHandles = parseCreatorHandles(creatorContext);
  const { fromDate, toDate } = dateWindow();
  const prompt = buildHourlyBriefPrompt({
    fromDate,
    toDate,
    existingTitles: titles,
    creatorHandles,
    creatorContext,
    editorialLearning,
  });

  let backend = "grok-x-search";
  let research = spawnSync(
    HERMES,
    [
      "chat",
      "--provider", "xai-oauth",
      "--model", "grok-4.5",
      "--toolsets", "x_search",
      "--ignore-rules",
      "--max-turns", "5",
      "--source", "cron",
      "--quiet",
      "--query", prompt,
    ],
    {
      cwd: "/tmp",
      env: childEnv(),
      encoding: "utf8",
      maxBuffer: 200_000,
      timeout: 180_000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (research.error) throw new Error(`brief_process_failed:${research.error.message}`);
  if (research.status !== 0) {
    const failure = `${research.stdout || ""}\n${research.stderr || ""}`;
    if (!isXaiCreditFailure(failure)) throw new Error(`brief_failed:${research.status ?? "signal"}`);
    const records = collectHourlyXContext(creatorHandles);
    if (!records.length) throw new Error("hourly_xurl_fallback_no_sources");
    const fallbackPrompt = appendDeterministicXContext(prompt, records);
    research = spawnSync(HERMES, buildFallbackHermesArgs(fallbackPrompt), {
      cwd: "/tmp",
      env: childEnv(),
      encoding: "utf8",
      maxBuffer: 200_000,
      timeout: 180_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    backend = "openai-codex+xurl-readonly";
    if (research.error) throw new Error(`brief_fallback_process_failed:${research.error.message}`);
    if (research.status !== 0) throw new Error(`brief_fallback_failed:${research.status ?? "signal"}`);
  }

  const brief = parseHourlyBrief(extractResearchEnvelope(research.stdout || ""));
  writeFileSync(OUT_TMP, JSON.stringify(brief), { mode: 0o600 });
  renameSync(OUT_TMP, OUT);

  const created: Array<{ id: string; title: string }> = [];
  const deliveryFailures: Array<{ draftId: string; chatId: string; error: string }> = [];
  for (const post of brief.posts) {
    const { data: draft, error } = await db
      .from("mc_drafts")
      .insert({
        title: post.title,
        body: post.body,
        preview: post.body.slice(0, 320),
        hook: post.angle || null,
        source: "hourly_brief",
        content_type: "post",
        language: post.language,
        status: "in_review",
        score: 80,
        metadata: {
          source: "hourly_brief",
          approval_channel: "telegram_otp_bot",
          trends: brief.trends,
          summary: brief.summary,
          source_urls: post.sourceUrls,
          creator_formula: post.creatorFormula,
          telegram_shared_delivery: true,
        },
      })
      .select("id,title,version")
      .single();
    if (error || !draft) throw new Error(`draft_create_failed:${error?.message || "unknown"}`);
    await db.from("mc_draft_revisions").insert({
      draft_id: draft.id,
      version: 1,
      title: post.title,
      body: post.body,
      author: "hourly_brief",
    });
    const proposal = {
      id: draft.id,
      version: Number(draft.version || 1),
      title: post.title,
      body: post.body,
      language: post.language,
      angle: post.angle || brief.trends[0] || brief.summary,
    };
    for (const recipientChatId of recipientChatIds) {
      try {
        await sendAndRegisterProposalCopy({
          db,
          botToken,
          chatId: recipientChatId,
          proposal,
        });
      } catch (deliveryError) {
        const message = deliveryError instanceof Error ? deliveryError.message : "telegram_delivery_failed";
        deliveryFailures.push({ draftId: draft.id, chatId: recipientChatId, error: message.slice(0, 240) });
        if (recipientChatId === chatId) throw deliveryError;
      }
    }
    created.push({ id: draft.id, title: draft.title });
  }

  await db.from("mc_events").insert({
    actor: "hourly_brief",
    event_type: "factory.hourly_brief_sent",
    entity_type: "system",
    entity_id: "telegram_otp_bot",
    payload: {
      posts: created.length,
      trends: brief.trends,
      draft_ids: created.map((c) => c.id),
      recipient_count: recipientChatIds.length,
      delivery_failures: deliveryFailures,
      backend,
    },
  });

  console.log(
    JSON.stringify({
      ok: true,
      posts: created.length,
      draftIds: created.map((c) => c.id),
      recipients: recipientChatIds.length,
      deliveryFailures: deliveryFailures.length,
      reconciliationFailures: reconciliationFailures.length,
      trends: brief.trends,
      backend,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.slice(0, 500) : "hourly_brief_failed");
  process.exitCode = 1;
});
