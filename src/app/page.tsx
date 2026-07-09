"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Ring, Sparkline, heatClass } from "@/components/charts";
import type { LiveBundle } from "@/lib/live";
import * as seed from "@/lib/data";

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

function statusTone(s: string) {
  if (s === "approved" || s === "posted" || s === "done") return "good" as const;
  if (s === "rejected" || s === "blocked" || s.includes("blocked"))
    return "bad" as const;
  if (s === "needs_approve" || s === "pending") return "warn" as const;
  return "neutral" as const;
}

function fallbackBundle(): LiveBundle {
  return {
    source: "seed",
    capturedAt: null,
    account: seed.account,
    statusCards: seed.statusCards,
    sparkFollowers: seed.sparkFollowers,
    sparkEngagement: seed.sparkEngagement,
    sparkPosts: seed.sparkPosts,
    funnel: seed.funnel,
    areas: seed.areas,
    drafts: seed.drafts,
    calendar: seed.calendar,
    scheduleSlots: seed.scheduleSlots,
    automations: seed.automations,
    pipeline: seed.pipeline,
    weeklyGoals: seed.weeklyGoals,
  };
}

export default function MissionControlPage() {
  const [tab, setTab] = useState<NavId>("board");
  const [data, setData] = useState<LiveBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/mc/live", { cache: "no-store" });
      if (!res.ok) throw new Error(`live ${res.status}`);
      const json = (await res.json()) as LiveBundle;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
      setData((prev) => prev || fallbackBundle());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const d = data || fallbackBundle();
  const pending = useMemo(
    () => d.drafts.filter((x) => x.status === "pending").length,
    [d.drafts],
  );
  const weeklyPct = Math.round(
    (d.weeklyGoals.reduce((a, g) => a + g.current / Math.max(g.target, 1), 0) /
      Math.max(d.weeklyGoals.length, 1)) *
      100,
  );

  async function setDraftStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/mc/drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `patch ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "patch failed");
    } finally {
      setBusyId(null);
    }
  }

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
                <Pill tone="invert">v1.4 live</Pill>
                <Pill tone={d.source === "supabase" ? "good" : "warn"}>
                  {d.source === "supabase" ? "supabase" : "seed fallback"}
                </Pill>
              </div>
              <div className="truncate font-mono text-[11px] text-neutral-500">
                {d.account.handle}
                {d.capturedAt
                  ? ` · synced ${new Date(d.capturedAt).toLocaleString()}`
                  : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-neutral-300 hover:bg-white/5"
            >
              {loading ? "loading…" : "refresh"}
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <Pill tone="good">xurl → sb</Pill>
              <Pill tone="warn">approve ON</Pill>
            </div>
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
          {error ? (
            <div className="mt-2 text-[11px] text-rose-300">{error}</div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {d.statusCards.map((c, i) => (
            <Card
              key={c.label}
              className={`p-4 ${i === 0 ? "border-white bg-white text-black" : ""}`}
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
                      ? d.sparkFollowers
                      : i === 2
                        ? d.sparkPosts
                        : d.sparkEngagement
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
              <Card className="p-5 lg:col-span-4">
                <Label>Week score</Label>
                <div className="mt-4 flex items-center gap-6">
                  <Ring value={weeklyPct} max={100} label="avg goals" />
                  <div className="flex-1 space-y-3">
                    {d.weeklyGoals.map((g) => (
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

              <Card className="p-5 lg:col-span-5">
                <Label>Attention → revenue funnel (7d)</Label>
                <div className="mt-4 space-y-3">
                  {d.funnel.map((f) => (
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
                          style={{ width: `${Math.min(100, f.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5 lg:col-span-3">
                <Label>Account live</Label>
                <dl className="mt-4 space-y-2.5 text-[12.5px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Plan</dt>
                    <dd>{d.account.plan}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Following</dt>
                    <dd className="font-mono">{d.account.following}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Likes</dt>
                    <dd className="font-mono">{d.account.likes}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Tweets</dt>
                    <dd className="font-mono">{d.account.tweets}</dd>
                  </div>
                </dl>
                <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-neutral-500">
                  {d.account.bio}
                </p>
              </Card>
            </div>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <Label>Content areas · weekly fill</Label>
                <Pill tone={d.source === "supabase" ? "good" : "warn"}>
                  {d.source}
                </Pill>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.areas.map((area) => {
                  const pct = Math.round(
                    (area.doneThisWeek / Math.max(area.weeklyTarget, 1)) * 100,
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
            <Card className="p-5">
              <Label>Factory pipeline</Label>
              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-stretch">
                {d.pipeline.map((stage, i) => (
                  <div key={stage.id} className="flex flex-1 items-stretch gap-3">
                    <div className="flex min-h-[110px] flex-1 flex-col justify-between rounded-xl border border-white/10 bg-black/50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                        {stage.label}
                      </div>
                      <div className="text-3xl font-semibold tabular-nums">
                        {stage.count}
                      </div>
                      <Pill tone={stage.tone === "warn" ? "warn" : stage.tone === "good" ? "good" : "neutral"}>
                        {stage.count === 0 ? "empty" : "active"}
                      </Pill>
                    </div>
                    {i < d.pipeline.length - 1 ? (
                      <div className="hidden items-center text-neutral-600 md:flex">
                        →
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === "calendar" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <Label>Week heatmap · posts + replies</Label>
                <Pill>programación</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {d.calendar.map((day) => (
                  <div
                    key={day.day}
                    className={`rounded-xl border border-white/10 p-3 ${heatClass(day.posts, day.replies)}`}
                  >
                    <div className="font-mono text-[11px] text-neutral-400">
                      {day.day}
                    </div>
                    <div className="mt-3 flex gap-3">
                      <div>
                        <div className="text-[10px] text-neutral-500">posts</div>
                        <div className="text-lg font-semibold tabular-nums">
                          {day.posts}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-500">
                          replies
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {day.replies}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] leading-snug text-neutral-400">
                      {day.focus}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <Label>Schedule queue</Label>
              <div className="mt-4 space-y-2">
                {d.scheduleSlots.map((s) => (
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
            {d.drafts.map((draft) => (
              <Card key={draft.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(draft.status)}>{draft.status}</Pill>
                  <Pill>{draft.area}</Pill>
                  <Pill>{draft.language}</Pill>
                  <Pill tone="invert">score {draft.score}</Pill>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">
                  {draft.title}
                </h2>
                <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-neutral-400">
                  {draft.preview}
                </p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[11px] text-neutral-500">
                    <span>Publish readiness</span>
                    <span className="font-mono">{draft.score}/100</span>
                  </div>
                  <Bar
                    value={draft.score}
                    tone={draft.score > 75 ? "good" : "warn"}
                  />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-[12px] text-neutral-500">
                    Source · {draft.source}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === draft.id}
                      onClick={() => setDraftStatus(draft.id, "approved")}
                      className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
                    >
                      SÍ · approve
                    </button>
                    <button
                      disabled={busyId === draft.id}
                      onClick={() => setDraftStatus(draft.id, "rejected")}
                      className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300 disabled:opacity-50"
                    >
                      NO
                    </button>
                    <button
                      disabled={busyId === draft.id}
                      onClick={() => setDraftStatus(draft.id, "pending")}
                      className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300 disabled:opacity-50"
                    >
                      RESET
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "auto" && (
          <div className="space-y-4">
            <Card className="p-5">
              <Label>Automation switches</Label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.automations.map((a) => (
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
                Live account metrics:{" "}
                <code className="text-neutral-300">
                  python3 ~/solvers-x-engine/scripts/sync_x_to_supabase.py
                </code>
              </p>
            </Card>
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
          v1.4 live · supabase · refresh 60s · approve writes to db
        </footer>
      </main>
    </div>
  );
}
