#!/usr/bin/env npx tsx

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractResearchEnvelope } from "../src/lib/factory/research-output";
import { parseResearchPayload } from "../src/lib/factory/research-contract";
import {
  buildHermesResearchArgs,
  buildResearchPrompt,
  parseCreatorHandles,
} from "../src/lib/factory/research-runner";

process.umask(0o077);

const ROOT = "/Users/kin/solvers-x-engine";
const APP = resolve(ROOT, "apps/dash.valentin.solvers");
const CONTEXT_PATH = "/tmp/solvers-factory-context.json";
const OUTPUT_PATH = "/tmp/solvers-research-output.json";
const OUTPUT_TMP = `${OUTPUT_PATH}.${process.pid}.tmp`;
const HERMES = process.env.HERMES_BIN || "hermes";

const STATIC_ALLOWED_HANDLES = [
  "OpenAI", "OpenAIDevs", "AnthropicAI", "xai", "GoogleDeepMind",
  "MistralAI", "LangChainAI", "llama_index", "supabase", "vercel",
  "simonw", "swyx", "karpathy", "hamelhusain", "jxnlco", "hwchase17",
  "runtools_ai", "johniosifov", "kunchenguid", "SeanHendryx",
  "tuprofedia", "maxirodr_", "_iamym", "japelbaum", "Irish7inian",
];

function readTrusted(path: string, max = 12_000) {
  return readFileSync(path, "utf8").slice(0, max);
}

function childEnvironment(): NodeJS.ProcessEnv {
  const keep = ["HOME", "PATH", "LANG", "LC_ALL", "TMPDIR", "USER", "SHELL", "HERMES_HOME"];
  return {
    NODE_ENV: "production",
    ...Object.fromEntries(
      keep.flatMap((key) => process.env[key] ? [[key, process.env[key] as string]] : []),
    ),
  };
}

function dateWindow() {
  const to = new Date();
  const from = new Date(to.getTime() - 2 * 24 * 60 * 60 * 1_000);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function main() {
  execFileSync(resolve(APP, "node_modules/.bin/tsx"), [
    resolve(APP, "scripts/factory-bridge.ts"),
    "context", "--output", CONTEXT_PATH,
  ], { cwd: APP, stdio: ["ignore", "ignore", "pipe"], timeout: 30_000 });

  const creatorsYaml = readTrusted(resolve(ROOT, "scouts/creators.yaml"));
  const allowedHandles = Array.from(new Set([
    ...STATIC_ALLOWED_HANDLES,
    ...parseCreatorHandles(creatorsYaml),
  ]));
  const brandContext = [
    ["VOICE", readTrusted(resolve(ROOT, "brand/voice.md"))],
    ["DO NOT SAY", readTrusted(resolve(ROOT, "brand/do-not-say.md"))],
    ["CONTENT SYSTEM", readTrusted(resolve(ROOT, "brand/content-system.md"))],
    ["PROOF BANK", readTrusted(resolve(ROOT, "brand/proof-bank.md"))],
    ["CREATOR MECHANISMS", creatorsYaml],
  ].map(([name, content]) => `## ${name}\n${content}`).join("\n\n");
  const factoryContext = readTrusted(CONTEXT_PATH, 50_000);
  const prompt = buildResearchPrompt({
    ...dateWindow(),
    allowedHandles,
    brandContext,
    factoryContext,
  });

  const research = spawnSync(HERMES, buildHermesResearchArgs(prompt), {
    cwd: "/tmp",
    env: childEnvironment(),
    encoding: "utf8",
    maxBuffer: 200_000,
    timeout: 240_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (research.error) throw new Error(`grok_research_process_failed:${research.error.message}`);
  if (research.status !== 0) throw new Error(`grok_research_failed:${research.status ?? "signal"}`);

  const untrusted = extractResearchEnvelope(research.stdout || "");
  const validated = parseResearchPayload(untrusted, { allowedHandles: new Set(allowedHandles) });
  writeFileSync(OUTPUT_TMP, JSON.stringify(validated), { mode: 0o600 });
  renameSync(OUTPUT_TMP, OUTPUT_PATH);

  const ingest = execFileSync(resolve(APP, "node_modules/.bin/tsx"), [
    resolve(APP, "scripts/factory-bridge.ts"),
    "ingest", "--input", OUTPUT_PATH, "--model", "grok-4.5",
  ], { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 45_000 });
  const line = ingest.trim().split(/\r?\n/u).at(-1) || "";
  const result = JSON.parse(line) as { ok?: boolean; runId?: string; signals?: number; drafts?: number };
  if (!result.ok) throw new Error("research_ingest_unconfirmed");
  console.log(JSON.stringify({
    ok: true,
    runId: result.runId,
    signals: result.signals,
    drafts: result.drafts,
    isolation: "x_search_only",
  }));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "isolated_research_failed";
  console.error(message.replace(/[\r\n]+/gu, " ").slice(0, 500));
  process.exitCode = 1;
}
