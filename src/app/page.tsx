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
    <div className="mc-grid min-h-screen">
      {/* TOP BAR — totally different shell from previous left-rail */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-[11px] font-bold tracking-tight text-black">
              S
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  Mission Control
                </span>
                <Pill tone="invert">v1.2 rewrite</Pill>
              </div>
              <div className="truncate font-mono text-[11px] text-neutral-500">
                solvers · {account.handle}
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Pill tone="good">xurl live</Pill>
            <Pill tone="warn">approve gate ON</Pill>
            <Pill>auto-post OFF</Pill>
          </div>
        </div>

        {/* Segmented control nav */}
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
                      ? "bg-white font-semibold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
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
        {/* Big visible banner so cache confusion is impossible */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-white via-neutral-200 to-neutral-400 p-[1px]">
          <div className="rounded-2xl bg-black px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Design pass 1.2 · top shell · Inter + JetBrains Mono · grid bg
                </div>
                <div className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                  Si ves este banner blanco, ya no es el layout viejo.
                </div>
              </div>
              <div className="font-mono text-[11px] text-neutral-400">
                hard refresh: Cmd+Shift+R
              </div>
            </div>
          </div>
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            {/* Hero strip */}
            <section className="grid gap-3 lg:grid-cols-12">
              <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5 lg:col-span-7">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Operator brief
                </div>
                <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
                  Agents do the work.
                  <br />
                  <span className="text-neutral-500">We build the systems.</span>
                </h1>
                <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-neutral-400">
                  Content factory para {account.handle}. Objetivo 90d:{" "}
                  <span className="text-neutral-200">
                    {account.objective90d}
                  </span>
                  . Publicación solo con approve humano.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill tone="invert">phase · calibración</Pill>
                  <Pill>{account.language}</Pill>
                  <Pill>{account.plan}</Pill>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:col-span-5">
                {statusCards.map((c, i) => (
                  <div
                    key={c.label}
                    className={`rounded-2xl border border-white/10 p-4 ${
                      i === 0 ? "bg-white text-black" : "bg-[#0c0c0c]"
                    }`}
                  >
                    <div
                      className={`text-[11px] ${
                        i === 0 ? "text-neutral-600" : "text-neutral-500"
                      }`}
                    >
                      {c.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight">
                      {c.value}
                    </div>
                    {c.hint ? (
                      <div
                        className={`mt-1 text-[11px] ${
                          i === 0 ? "text-neutral-500" : "text-neutral-600"
                        }`}
                      >
                        {c.hint}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Diagnosis
                </div>
                <ul className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-neutral-400">
                  <li className="border-l-2 border-white/20 pl-3">
                    Bio agentic vs feed reciente disperso → cerrar gap con casos
                    reales.
                  </li>
                  <li className="border-l-2 border-white/20 pl-3">
                    Oro ya existe: Hermes, Claude one-shot, tools que queman
                    cuenta.
                  </li>
                  <li className="border-l-2 border-white/20 pl-3">
                    High-ticket + valor público = historias de Solvers, no stacks
                    robóticos.
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                    Needs you
                  </div>
                  <Pill tone="warn">3 open</Pill>
                </div>
                <div className="space-y-2">
                  {[
                    "Approve draft: tool burned account",
                    "1 captura real Solvers (voz/texto)",
                    "5 creators LATAM/ES para scout",
                  ].map((t, idx) => (
                    <div
                      key={t}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-3"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white font-mono text-[11px] font-bold text-black">
                        {idx + 1}
                      </div>
                      <div className="text-[13px] text-neutral-200">{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "areas" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {areas.map((area) => (
              <div
                key={area.id}
                className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.14em] text-neutral-500">
                      {area.code}
                    </div>
                    <div className="mt-1 text-[15px] font-semibold tracking-tight">
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
                <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">
                  {area.description}
                </p>
                <div className="mt-4 border-t border-white/10 pt-3 font-mono text-[11px] text-neutral-500">
                  weekly · {area.weeklyTarget}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "drafts" && (
          <div className="space-y-3">
            {drafts.map((d) => (
              <article
                key={d.id}
                className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={statusTone(d.status)}>{d.status}</Pill>
                  <Pill>{d.area}</Pill>
                  <Pill>{d.language}</Pill>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {d.updatedAt}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight">
                  {d.title}
                </h2>
                <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-neutral-400">
                  {d.preview}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-[12px] text-neutral-500">
                    Source · {d.source}
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold text-black">
                      SÍ
                    </button>
                    <button className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300">
                      NO
                    </button>
                    <button className="rounded-full border border-white/15 px-4 py-1.5 text-[12px] text-neutral-300">
                      CAMBIAR
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "week" && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  <th className="px-5 py-3.5 font-medium">Day</th>
                  <th className="px-5 py-3.5 font-medium">Piece</th>
                  <th className="px-5 py-3.5 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr
                    key={w.day + w.item}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] text-neutral-500">
                      {w.day}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-200">{w.item}</td>
                    <td className="px-5 py-3.5">
                      <Pill
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
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ops" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                Connected stack
              </div>
              <dl className="mt-4 space-y-3 text-[13px]">
                {(
                  [
                    ["GitHub", infra.github],
                    ["Vercel", infra.vercelAccount],
                    ["Supabase", infra.supabaseProject],
                    ["X", infra.xAccount],
                    ["Hermes", infra.hermesPath],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="font-mono text-[11px] text-neutral-300">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                Operating loops
              </div>
              <ol className="mt-4 list-decimal space-y-2.5 pl-4 text-[13px] leading-relaxed text-neutral-400">
                {processes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-600">
          design rewrite 1.2 · top nav · bento · white hero card · not the old sidebar
        </footer>
      </main>
    </div>
  );
}
