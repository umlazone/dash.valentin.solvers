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

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "solid";
}) {
  const styles = {
    neutral: "border-neutral-800 bg-neutral-950 text-neutral-400",
    good: "border-emerald-500/25 bg-emerald-500/5 text-emerald-400",
    warn: "border-yellow-500/25 bg-yellow-500/5 text-yellow-400",
    bad: "border-red-500/25 bg-red-500/5 text-red-400",
    solid: "border-transparent bg-white text-black",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function toneForStatus(s: DraftStatus) {
  if (s === "approved" || s === "posted") return "good" as const;
  if (s === "rejected") return "bad" as const;
  return "warn" as const;
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-900 bg-[#0a0a0a] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
      {children}
    </div>
  );
}

export default function MissionControlPage() {
  const [tab, setTab] = useState<NavId>("overview");
  const pending = useMemo(
    () => drafts.filter((d) => d.status === "pending").length,
    [],
  );

  const titles: Record<NavId, { h: string; s: string }> = {
    overview: {
      h: "Overview",
      s: "Phase, account health, and what needs you.",
    },
    areas: {
      h: "Content areas",
      s: "Factory lanes. Core first, growth second.",
    },
    drafts: {
      h: "Draft queue",
      s: "Approve before anything hits X.",
    },
    week: {
      h: "This week",
      s: "Cadence board. Blocked items need capture.",
    },
    ops: {
      h: "Infrastructure",
      s: "Stack, loops, and operating rules.",
    },
  };

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-[1280px]">
        {/* Rail */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-neutral-900 px-4 py-6 md:flex">
          <div className="px-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-600">
              Solvers
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-tight">
              Mission Control
            </div>
            <div className="mt-1 font-mono text-[11px] text-neutral-500">
              {account.handle}
            </div>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-0.5">
            {nav.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                    active
                      ? "bg-white font-medium text-black"
                      : "text-neutral-400 hover:bg-neutral-950 hover:text-neutral-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.id === "drafts" && pending > 0 ? (
                    <span
                      className={`min-w-5 rounded-full px-1.5 text-center text-[10px] font-medium ${
                        active
                          ? "bg-black text-white"
                          : "bg-neutral-800 text-neutral-200"
                      }`}
                    >
                      {pending}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 border-t border-neutral-900 px-2 pt-4 text-[11px] text-neutral-600">
            <div className="flex justify-between">
              <span>Auto-post</span>
              <span className="text-neutral-400">OFF</span>
            </div>
            <div className="flex justify-between">
              <span>Approve gate</span>
              <span className="text-neutral-400">ON</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <header className="mb-7 border-b border-neutral-900 pb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-600">
                  Content factory
                </div>
                <h1 className="mt-2 text-[28px] font-semibold leading-none tracking-tight">
                  {titles[tab].h}
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                  {titles[tab].s}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>Phase · calibración</Chip>
                <Chip tone="good">xurl · live</Chip>
                <Chip tone="warn">demo data</Chip>
              </div>
            </div>

            {/* Mobile nav */}
            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
              {nav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[12px] ${
                    tab === item.id
                      ? "border-white bg-white text-black"
                      : "border-neutral-800 text-neutral-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          {tab === "overview" && (
            <div className="space-y-5">
              <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {statusCards.map((c) => (
                  <Panel key={c.label} className="px-3.5 py-3.5">
                    <div className="text-[11px] text-neutral-500">{c.label}</div>
                    <div className="mt-1.5 text-[22px] font-semibold tracking-tight">
                      {c.value}
                    </div>
                    {c.hint ? (
                      <div className="mt-1 text-[11px] text-neutral-600">
                        {c.hint}
                      </div>
                    ) : null}
                  </Panel>
                ))}
              </section>

              <section className="grid gap-2.5 lg:grid-cols-5">
                <Panel className="p-4 lg:col-span-2">
                  <SectionLabel>Account</SectionLabel>
                  <dl className="space-y-2.5 text-[13px]">
                    {[
                      ["Handle", account.handle, true],
                      ["Plan", account.plan, false],
                      ["Language", account.language, false],
                      ["90d", account.objective90d, false],
                    ].map(([k, v, mono]) => (
                      <div
                        key={String(k)}
                        className="flex items-start justify-between gap-4"
                      >
                        <dt className="shrink-0 text-neutral-500">{k}</dt>
                        <dd
                          className={`text-right text-neutral-200 ${
                            mono ? "font-mono text-[12px]" : ""
                          }`}
                        >
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 border-t border-neutral-900 pt-3 text-[12px] leading-relaxed text-neutral-500">
                    {account.bio}
                  </p>
                </Panel>

                <Panel className="p-4 lg:col-span-3">
                  <SectionLabel>Diagnosis</SectionLabel>
                  <ul className="space-y-3 text-[13px] leading-relaxed text-neutral-400">
                    <li className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                      Bio promises agentic ops; recent feed is inconsistent.
                      Factory closes the bio↔feed gap.
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                      Real signal already exists: Hermes vs OpenClaw, Claude
                      one-shot site, tools that burn accounts.
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                      Ship cases and takes with proof — never robotic stacks.
                    </li>
                  </ul>
                </Panel>
              </section>

              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <SectionLabel>Needs you</SectionLabel>
                  <Chip tone="warn">owner action</Chip>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {[
                    {
                      n: "01",
                      t: "Approve draft",
                      d: "Tool that burned the account — SÍ / NO / CAMBIAR",
                    },
                    {
                      n: "02",
                      t: "Send a capture",
                      d: "One real Solvers moment (voice or text)",
                    },
                    {
                      n: "03",
                      t: "Creators list",
                      d: "5 LATAM/ES handles for mechanism scout",
                    },
                  ].map((a) => (
                    <div
                      key={a.n}
                      className="rounded-md border border-neutral-900 bg-black px-3 py-3"
                    >
                      <div className="font-mono text-[10px] text-neutral-600">
                        {a.n}
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-neutral-100">
                        {a.t}
                      </div>
                      <div className="mt-1 text-[12px] leading-relaxed text-neutral-500">
                        {a.d}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}

          {tab === "areas" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {areas.map((area) => (
                <Panel key={area.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] tracking-wide text-neutral-600">
                        {area.code}
                      </div>
                      <div className="mt-1 text-[14px] font-medium">
                        {area.name}
                      </div>
                    </div>
                    <Chip
                      tone={
                        area.priority === "core"
                          ? "good"
                          : area.priority === "growth"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {area.priority}
                    </Chip>
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-neutral-400">
                    {area.description}
                  </p>
                  <div className="mt-3 border-t border-neutral-900 pt-2.5 text-[11px] text-neutral-600">
                    Weekly · {area.weeklyTarget}
                  </div>
                </Panel>
              ))}
            </div>
          )}

          {tab === "drafts" && (
            <div className="space-y-2.5">
              {drafts.map((d) => (
                <article key={d.id}>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone={toneForStatus(d.status)}>{d.status}</Chip>
                      <Chip>{d.area}</Chip>
                      <Chip>{d.language}</Chip>
                      <span className="font-mono text-[11px] text-neutral-600">
                        {d.updatedAt}
                      </span>
                    </div>
                    <h2 className="mt-3 text-[16px] font-medium tracking-tight">
                      {d.title}
                    </h2>
                    <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-400">
                      {d.preview}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-900 pt-3">
                      <div className="text-[11px] text-neutral-600">
                        Source · {d.source}
                      </div>
                      <div className="flex gap-1.5">
                        {["SÍ", "NO", "CAMBIAR"].map((a) => (
                          <span
                            key={a}
                            className="rounded-md border border-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-400"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Panel>
                </article>
              ))}
              <p className="px-1 pt-1 text-[11px] text-neutral-600">
                v1: approve via Telegram. Next: wire actions → Supabase → xurl.
              </p>
            </div>
          )}

          {tab === "week" && (
            <Panel className="overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-neutral-900 text-[11px] uppercase tracking-[0.12em] text-neutral-600">
                    <th className="px-4 py-3 font-medium">Day</th>
                    <th className="px-4 py-3 font-medium">Piece</th>
                    <th className="px-4 py-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((w) => (
                    <tr
                      key={w.day + w.item}
                      className="border-b border-neutral-900/80 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-neutral-500">
                        {w.day}
                      </td>
                      <td className="px-4 py-3 text-neutral-200">{w.item}</td>
                      <td className="px-4 py-3">
                        <Chip
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
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {tab === "ops" && (
            <div className="grid gap-2.5 lg:grid-cols-2">
              <Panel className="p-4">
                <SectionLabel>Connected stack</SectionLabel>
                <dl className="space-y-2.5 text-[13px]">
                  {(
                    [
                      ["GitHub", infra.github],
                      ["Vercel", infra.vercelAccount],
                      ["Supabase", infra.supabaseProject],
                      ["X", infra.xAccount],
                      ["Hermes vault", infra.hermesPath],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-neutral-500">{k}</dt>
                      <dd className="font-mono text-[11px] text-neutral-300">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel className="p-4">
                <SectionLabel>Operating loops</SectionLabel>
                <ol className="list-decimal space-y-2.5 pl-4 text-[13px] leading-relaxed text-neutral-400">
                  {processes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </Panel>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
