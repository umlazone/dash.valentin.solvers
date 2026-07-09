"use client";

import { useMemo, useState } from "react";
import { Bar, Ring, Sparkline, heatClass } from "@/components/charts";
import {
  account,
  areas,
  automations,
  calendar,
  drafts,
  funnel,
  pipeline,
  scheduleSlots,
  sparkEngagement,
  sparkFollowers,
  sparkPosts,
  statusCards,
  weeklyGoals,
  type DraftStatus,
} from "@/lib/data";

const nav = [
  { id: "board", label: "Board" },
  { id: "pipeline", label: "Pipeline" },
  { id: "calendar", label: "Calendar" },
  { id: "drafts", label: "Drafts" },
  { id: "auto", label: "Automate" },
] as const;

type NavId = (typeof nav)[number]["id"];

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "invert";
}) {
  const map = {
    neutral: "border-white/10 bg-white/[0.03] text-neutral-300",
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bad: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    invert: "border-transparent bg-white text-black",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#0c0c0c] ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
      {children}
    </div>
  );
}

function statusTone(s: DraftStatus | string) {
  if (s === "approved" || s === "posted" || s === "done") return "good" as const;
  if (s === "rejected" || s === "blocked" || String(s).includes("blocked"))
    return "bad" as const;
  if (s === "needs_approve" || s === "pending") return "warn" as const;
  return "neutral" as const;
}

export default function MissionControlPage() {
  const [tab, setTab] = useState<NavId>("board");
  const pending = useMemo(
    () => drafts.filter((d) => d.status === "pending").length,
    [],
  );
  const weeklyPct = Math.round(
    (weeklyGoals.reduce((a, g) => a + g.current / g.target, 0) /
      weeklyGoals.length) *
      100,
  );

  return (
    <div className="mc-grid min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[11px] font-bold text-black">
              S
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Mission Control
                </span>
                <Pill tone="invert">v1.3 ops</Pill>
              </div>
              <div className="truncate font-mono text-[11px] text-neutral-500">
                content factory · {account.handle}
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Pill tone="good">xurl live</Pill>
            <Pill tone="warn">approve ON</Pill>
            <Pill>auto-post OFF</Pill>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {nav.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] transition ${
                    active
                      ? "bg-white font-semibold text-black"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                  }`}
                >
                  {item.label}
                  {item.id === "drafts" && pending > 0 ? (
                    <span
                      className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        active ? "bg-black text-white" : "bg-white/15 text-white"
                      }`}
                    >
                      {pending}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* KPI row — always visible */}
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statusCards.map((c, i) => (
            <Card
              key={c.label}
              className={`p-4 ${i === 0 ? "bg-white text-black border-white" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className={`text-[11px] ${i === 0 ? "text-neutral-600" : "text-neutral-500"}`}
                  >
                    {c.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {c.value}
                  </div>
                  <div
                    className={`mt-1 text-[11px] ${i === 0 ? "text-neutral-500" : "text-neutral-600"}`}
                  >
                    {c.hint}
                  </div>
                </div>
                <Sparkline
                  data={
                    i === 0
                      ? sparkFollowers
                      : i === 2
                        ? sparkPosts
                        : sparkEngagement
                  }
                  stroke={i === 0 ? "#000" : "#fff"}
                  width={88}
                  height={32}
                />
              </div>
            </Card>
          ))}
        </section>

        {tab === "board" && (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-12">
              {/* Weekly score */}
              <Card className="p-5 lg:col-span-4">
                <Label>Week score</Label>
                <div className="mt-4 flex items-center gap-6">
                  <Ring value={weeklyPct} max={100} label="avg goals" />
                  <div className="flex-1 space-y-3">
                    {weeklyGoals.map((g) => (
                      <div key={g.label}>
                        <div className="mb-1 flex justify-between text-[12px]">
                          <span className="text-neutral-400">{g.label}</span>
                          <span className="font-mono tabular-nums text-neutral-200">
                            {g.current}/{g.target}
                          </span>
                        </div>
                        <Bar
                          value={g.current}
                          max={g.target}
                          tone={
                            g.current / g.target >= 0.7
                              ? "good"
                              : g.current / g.target >= 0.3
                                ? "warn"
                                : "bad"
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Funnel visual */}
              <Card className="p-5 lg:col-span-5">
                <Label>Attention → revenue funnel (7d)</Label>
                <div className="mt-4 space-y-3">
                  {funnel.map((f) => (
                    <div key={f.stage}>
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className="text-neutral-400">{f.stage}</span>
                        <span className="font-mono tabular-nums text-neutral-200">
                          {f.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white"
                          style={{ width: `${f.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Live actions */}
              <Card className="p-5 lg:col-span-3">
                <Label>Do next</Label>
                <div className="mt-4 space-y-2">
                  {[
                    { t: "Aprobar draft A5", s: "warn" as const },
                    { t: "Captura Solvers", s: "bad" as const },
                    { t: "10 replies valor", s: "neutral" as const },
                    { t: "Programar Jue/Vie", s: "neutral" as const },
                  ].map((a, i) => (
                    <div
                      key={a.t}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-mono text-[10px] font-bold text-black">
                        {i + 1}
                      </div>
                      <div className="flex-1 text-[12.5px] text-neutral-200">
                        {a.t}
                      </div>
                      <Pill tone={a.s}>go</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Areas as progress grid */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <Label>Content areas · weekly fill</Label>
                <Pill>visual load, not walls of text</Pill>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {areas.map((area) => {
                  const pct = Math.round(
                    (area.doneThisWeek / area.weeklyTarget) * 100,
                  );
                  return (
                    <div
                      key={area.id}
                      className="rounded-xl border border-white/10 bg-black/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-[10px] text-neutral-500">
                            {area.code}
                          </div>
                          <div className="mt-0.5 text-[13px] font-medium">
                            {area.name}
                          </div>
                        </div>
                        <Pill
                          tone={
                            area.priority === "core"
                              ? "good"
                              : area.priority === "growth"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {area.priority}
                        </Pill>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div className="font-mono text-2xl font-semibold tabular-nums">
                          {pct}
                          <span className="text-sm text-neutral-500">%</span>
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {area.doneThisWeek}/{area.weeklyTarget} this week
                        </div>
                      </div>
                      <div className="mt-2">
                        <Bar
                          value={area.doneThisWeek}
                          max={area.weeklyTarget}
                          tone={pct >= 100 ? "good" : pct > 0 ? "warn" : "bad"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {tab === "pipeline" && (
          <div className="space-y-4">
            {/* Factory conveyor */}
            <Card className="p-5">
              <Label>Factory pipeline</Label>
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-stretch">
                {pipeline.map((stage, i) => (
                  <div key={stage.id} className="flex flex-1 items-stretch gap-3">
                    <div className="flex min-h-[110px] flex-1 flex-col justify-between rounded-xl border border-white/10 bg-black/50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                        {stage.label}
                      </div>
                      <div className="text-3xl font-semibold tabular-nums">
                        {stage.count}
                      </div>
                      <Pill tone={stage.tone}>
                        {stage.count === 0 ? "empty" : "active"}
                      </Pill>
                    </div>
                    {i < pipeline.length - 1 ? (
                      <div className="hidden items-center text-neutral-600 md:flex">
                        →
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-neutral-500">
                Flujo: captura → scout → draft → approve → schedule → post.
                El cuello de botella hoy:{" "}
                <span className="text-amber-200">drafts sin approve</span> y{" "}
                <span className="text-rose-300">0 capturas Solvers</span>.
              </p>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="p-5">
                <Label>Where work dies</Label>
                <div className="mt-4 space-y-3">
                  {[
                    { k: "Sin captura real", v: 70 },
                    { k: "Draft sin approve", v: 55 },
                    { k: "Sin schedule slot", v: 40 },
                    { k: "Replies no hechas", v: 65 },
                  ].map((x) => (
                    <div key={x.k}>
                      <div className="mb-1 flex justify-between text-[12px]">
                        <span className="text-neutral-400">{x.k}</span>
                        <span className="font-mono text-neutral-300">{x.v}%</span>
                      </div>
                      <Bar value={x.v} tone={x.v > 60 ? "bad" : "warn"} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <Label>Post mix target (ES/EN · types)</Label>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { k: "ES posts", v: 85, t: "good" as const },
                    { k: "EN selective", v: 15, t: "neutral" as const },
                    { k: "Casos / roadblocks", v: 40, t: "warn" as const },
                    { k: "Replies / quotes", v: 45, t: "good" as const },
                  ].map((x) => (
                    <div
                      key={x.k}
                      className="rounded-xl border border-white/10 bg-black/40 p-3"
                    >
                      <div className="text-[11px] text-neutral-500">{x.k}</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums">
                        {x.v}%
                      </div>
                      <div className="mt-2">
                        <Bar value={x.v} tone={x.t} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "calendar" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <Label>Week heatmap · posts + replies</Label>
                <Pill>programación visual</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {calendar.map((d) => (
                  <div
                    key={d.day}
                    className={`rounded-xl border border-white/10 p-3 ${heatClass(d.posts, d.replies)}`}
                  >
                    <div className="font-mono text-[11px] text-neutral-400">
                      {d.day}
                    </div>
                    <div className="mt-3 flex gap-3">
                      <div>
                        <div className="text-[10px] text-neutral-500">posts</div>
                        <div className="text-lg font-semibold tabular-nums">
                          {d.posts}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500">
                          replies
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {d.replies}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] leading-snug text-neutral-400">
                      {d.focus}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <Label>Schedule queue</Label>
              <div className="mt-4 space-y-2">
                {scheduleSlots.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-mono text-[11px] text-neutral-500">
                        {s.when} · {s.channel}
                      </div>
                      <div className="mt-0.5 text-[14px] font-medium text-neutral-100">
                        {s.title}
                      </div>
                    </div>
                    <Pill tone={statusTone(s.status)}>
                      {s.status.replace("_", " ")}
                    </Pill>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "drafts" && (
          <div className="space-y-3">
            {drafts.map((d) => (
              <Card key={d.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(d.status)}>{d.status}</Pill>
                  <Pill>{d.area}</Pill>
                  <Pill>{d.language}</Pill>
                  <Pill tone="invert">score {d.score}</Pill>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">
                  {d.title}
                </h2>
                <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-neutral-400">
                  {d.preview}
                </p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                    <span>Publish readiness</span>
                    <span className="font-mono">{d.score}/100</span>
                  </div>
                  <Bar value={d.score} tone={d.score > 75 ? "good" : "warn"} />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-[12px] text-neutral-500">
                    Source · {d.source}
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black">
                      SÍ · schedule
                    </button>
                    <button className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300">
                      NO
                    </button>
                    <button className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300">
                      CAMBIAR
                    </button>
                  </div>
                </div>
              </Card>
            ))}
            <p className="px-1 text-[11px] text-neutral-600">
              v1.3 UI: approve visual listo. Wire → Supabase + xurl en v1.4.
            </p>
          </div>
        )}

        {tab === "auto" && (
          <div className="space-y-4">
            <Card className="p-5">
              <Label>Automation switches</Label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {automations.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-medium">{a.name}</div>
                        <div className="mt-1 text-[12px] leading-relaxed text-neutral-400">
                          {a.desc}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-neutral-600">
                          {a.cadence}
                        </div>
                      </div>
                      <div
                        className={`relative h-6 w-11 shrink-0 rounded-full ${
                          a.enabled ? "bg-white" : "bg-white/15"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-5 w-5 rounded-full transition ${
                            a.enabled
                              ? "right-0.5 bg-black"
                              : "left-0.5 bg-neutral-400"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-neutral-500">
                Auto-publish se queda OFF hasta que el tono y el approve loop
                estén estables. El resto se enciende con Hermes cron.
              </p>
            </Card>

            <div className="grid gap-3 lg:grid-cols-3">
              {[
                {
                  t: "Programar contenido",
                  d: "Calendar + schedule queue → slots con estado",
                },
                {
                  t: "Crear drafts",
                  d: "Captura / scout → draft score → approve",
                },
                {
                  t: "Automatizar",
                  d: "Pulse + scout ON; post solo approved",
                },
              ].map((x) => (
                <Card key={x.t} className="p-4">
                  <div className="text-[13px] font-medium">{x.t}</div>
                  <div className="mt-2 text-[12px] leading-relaxed text-neutral-400">
                    {x.d}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
          v1.3 · sparklines · funnel · heatmap · pipeline · automation panel
        </footer>
      </main>
    </div>
  );
}
