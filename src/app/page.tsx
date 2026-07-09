"use client";

import { useMemo, useState } from "react";
import {
  account,
  areas,
  drafts,
  infra,
  processes,
  statusCards,
  weekly,
  type DraftStatus,
} from "@/lib/data";

const nav = [
  { id: "overview", label: "Overview" },
  { id: "areas", label: "Areas" },
  { id: "drafts", label: "Drafts" },
  { id: "week", label: "Week" },
  { id: "ops", label: "Ops" },
] as const;

type NavId = (typeof nav)[number]["id"];

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const map = {
    neutral: "border-zinc-700 text-zinc-300",
    good: "border-emerald-500/40 text-emerald-400",
    warn: "border-yellow-500/40 text-yellow-400",
    bad: "border-red-500/40 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function statusTone(s: DraftStatus) {
  if (s === "approved" || s === "posted") return "good" as const;
  if (s === "rejected") return "bad" as const;
  return "warn" as const;
}

export default function MissionControlPage() {
  const [tab, setTab] = useState<NavId>("overview");
  const pending = useMemo(
    () => drafts.filter((d) => d.status === "pending").length,
    [],
  );

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-zinc-900 p-5 md:block">
          <div className="mb-10">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Solvers
            </div>
            <div className="mt-1 text-lg font-medium tracking-tight">
              Mission Control
            </div>
            <div className="mt-1 font-mono text-xs text-zinc-500">
              {account.handle}
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  tab === item.id
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:bg-zinc-950 hover:text-zinc-100"
                }`}
              >
                <span>{item.label}</span>
                {item.id === "drafts" && pending > 0 ? (
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      tab === item.id
                        ? "bg-black text-white"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {pending}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="mt-10 border-t border-zinc-900 pt-5 text-xs text-zinc-600">
            <div>Auto-post: OFF</div>
            <div className="mt-1">Human approve: ON</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-5 md:p-8">
          <header className="mb-8 flex flex-col gap-4 border-b border-zinc-900 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Content factory
              </div>
              <h1 className="mt-2 text-3xl font-medium tracking-tight">
                {tab === "overview" && "Overview"}
                {tab === "areas" && "Content areas"}
                {tab === "drafts" && "Draft queue"}
                {tab === "week" && "This week"}
                {tab === "ops" && "Infrastructure"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                {account.bio}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Phase: {account.phase}</Badge>
              <Badge tone="good">xurl connected</Badge>
              <Badge tone="warn">demo data + live account snapshot</Badge>
            </div>
          </header>

          {/* Mobile nav */}
          <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
                  tab === item.id
                    ? "border-white bg-white text-black"
                    : "border-zinc-800 text-zinc-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-6">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statusCards.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4"
                  >
                    <div className="text-xs text-zinc-500">{c.label}</div>
                    <div className="mt-2 text-2xl font-medium tracking-tight">
                      {c.value}
                    </div>
                    {c.hint ? (
                      <div className="mt-1 text-xs text-zinc-600">{c.hint}</div>
                    ) : null}
                  </div>
                ))}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5">
                  <div className="mb-3 text-sm font-medium">Account</div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Handle</dt>
                      <dd className="font-mono">{account.handle}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Plan</dt>
                      <dd>{account.plan}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">90d goal</dt>
                      <dd className="text-right text-zinc-300">
                        {account.objective90d}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Language</dt>
                      <dd>{account.language}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5">
                  <div className="mb-3 text-sm font-medium">Diagnosis</div>
                  <ul className="space-y-2 text-sm text-zinc-400">
                    <li>
                      Bio promises agentic ops; recent feed is inconsistent.
                    </li>
                    <li>
                      Gold exists: Hermes vs OpenClaw, Claude one-shot site,
                      tools that burn accounts.
                    </li>
                    <li>
                      Factory must close bio↔feed gap with real cases — not
                      robotic stacks.
                    </li>
                  </ul>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-medium">Next actions</div>
                  <Badge tone="warn">needs Valentin</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    "Approve or rewrite draft: tool burned account",
                    "Send 1 real Solvers capture (voice/text)",
                    "Confirm 5 creators LATAM/ES for scout",
                  ].map((a) => (
                    <div
                      key={a}
                      className="rounded-lg border border-zinc-900 bg-black px-3 py-3 text-sm text-zinc-300"
                    >
                      {a}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "areas" && (
            <div className="grid gap-3 md:grid-cols-2">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs text-zinc-500">
                        {area.code}
                      </div>
                      <div className="mt-1 text-base font-medium">
                        {area.name}
                      </div>
                    </div>
                    <Badge
                      tone={
                        area.priority === "core"
                          ? "good"
                          : area.priority === "growth"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {area.priority}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    {area.description}
                  </p>
                  <div className="mt-4 text-xs text-zinc-600">
                    Weekly target: {area.weeklyTarget}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "drafts" && (
            <div className="space-y-4">
              {drafts.map((d) => (
                <article
                  key={d.id}
                  className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                    <Badge>{d.area}</Badge>
                    <Badge>{d.language}</Badge>
                    <span className="text-xs text-zinc-600">{d.updatedAt}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-medium tracking-tight">
                    {d.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                    {d.preview}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 pt-4">
                    <div className="text-xs text-zinc-600">
                      Source: {d.source}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-md border border-zinc-800 px-2 py-1 text-zinc-400">
                        SÍ
                      </span>
                      <span className="rounded-md border border-zinc-800 px-2 py-1 text-zinc-400">
                        NO
                      </span>
                      <span className="rounded-md border border-zinc-800 px-2 py-1 text-zinc-400">
                        CAMBIAR
                      </span>
                    </div>
                  </div>
                </article>
              ))}
              <p className="text-xs text-zinc-600">
                v1 demo: approve actions via Telegram. Next: wire buttons to
                Supabase + xurl publish.
              </p>
            </div>
          )}

          {tab === "week" && (
            <div className="overflow-hidden rounded-xl border border-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Day</th>
                    <th className="px-4 py-3 font-medium">Piece</th>
                    <th className="px-4 py-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((w) => (
                    <tr
                      key={w.day + w.item}
                      className="border-t border-zinc-900"
                    >
                      <td className="px-4 py-3 font-mono text-zinc-400">
                        {w.day}
                      </td>
                      <td className="px-4 py-3">{w.item}</td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            w.state === "pending"
                              ? "warn"
                              : w.state.includes("needs") ||
                                  w.state.includes("blocked")
                                ? "bad"
                                : "neutral"
                          }
                        >
                          {w.state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "ops" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5">
                <div className="mb-3 text-sm font-medium">Connected stack</div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">GitHub</dt>
                    <dd className="font-mono text-xs">{infra.github}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Vercel</dt>
                    <dd className="font-mono text-xs">{infra.vercelAccount}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Supabase</dt>
                    <dd className="font-mono text-xs">
                      {infra.supabaseProject}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">X</dt>
                    <dd className="font-mono text-xs">{infra.xAccount}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Hermes vault</dt>
                    <dd className="font-mono text-xs">{infra.hermesPath}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-5">
                <div className="mb-3 text-sm font-medium">Operating loops</div>
                <ol className="list-decimal space-y-2 pl-4 text-sm text-zinc-400">
                  {processes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
