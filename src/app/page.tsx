"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  Command,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ArcGauge, HorizonChart, MicroLine } from "@/components/agency-charts";
import type { LiveBundle } from "@/lib/live";
import * as seed from "@/lib/data";

const nav: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "command", label: "Command", icon: LayoutDashboard },
  { id: "production", label: "Producción", icon: Workflow },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "review", label: "Revisión", icon: FileText },
  { id: "systems", label: "Sistemas", icon: Settings2 },
];

type ViewId = "command" | "production" | "calendar" | "review" | "systems";

const viewCopy: Record<ViewId, { eyebrow: string; title: string; description: string }> = {
  command: {
    eyebrow: "Centro de mando",
    title: "La semana, en una sola lectura.",
    description:
      "Prioridades, producción y distribución del content engine de Solvers.",
  },
  production: {
    eyebrow: "Content factory",
    title: "La producción no se pierde en chats.",
    description:
      "Cada idea avanza desde una captura real hasta una publicación medible.",
  },
  calendar: {
    eyebrow: "Programación",
    title: "El runway editorial de Solvers.",
    description:
      "Visibilidad semanal de posts, replies, bloqueos y ventanas de publicación.",
  },
  review: {
    eyebrow: "Sala de revisión",
    title: "Nada sale sin criterio.",
    description:
      "Revisa, aprueba o devuelve los drafts antes de programarlos en X.",
  },
  systems: {
    eyebrow: "Agentes y automatizaciones",
    title: "El sistema detrás del sistema.",
    description:
      "Fuentes, sincronización, loops autónomos y gates de seguridad.",
  },
};

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

function toneForStatus(status: string) {
  if (["approved", "posted", "done", "live"].includes(status)) return "good";
  if (status === "rejected" || status.includes("blocked")) return "bad";
  if (status === "pending" || status.includes("approve")) return "warn";
  return "neutral";
}

function statusCopy(status: string) {
  const map: Record<string, string> = {
    pending: "Por aprobar",
    approved: "Aprobado",
    posted: "Publicado",
    rejected: "Descartado",
    needs_approve: "Necesita aprobación",
    blocked: "Bloqueado",
    planned: "Planeado",
  };
  return map[status] || status.replaceAll("_", " ");
}

function StatusLabel({ status, children }: { status: string; children?: React.ReactNode }) {
  return (
    <span className="status-label" data-tone={toneForStatus(status)}>
      {children || statusCopy(status)}
    </span>
  );
}

function SectionHeading({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="section-kicker">{meta}</div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function AgencyRail({
  view,
  onView,
  pending,
  source,
}: {
  view: ViewId;
  onView: (view: ViewId) => void;
  pending: number;
  source: LiveBundle["source"];
}) {
  return (
    <aside className="agency-rail" aria-label="Navegación principal">
      <div className="wordmark">
        <div className="wordmark__mark">S</div>
        <div>
          <div className="wordmark__name">SOLVERS</div>
          <div className="wordmark__edition">Agency OS · 2.0</div>
        </div>
      </div>

      <button className="workspace-switcher" type="button" aria-label="Cambiar workspace">
        <div className="workspace-switcher__label">Workspace</div>
        <div className="workspace-switcher__value">
          <span>Valentin / Content</span>
          <ChevronDown size={13} aria-hidden="true" />
        </div>
      </button>

      <nav className="agency-nav">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="nav-button"
              data-active={view === item.id}
              onClick={() => onView(item.id)}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span className="nav-button__label">{item.label}</span>
              {item.id === "review" && pending > 0 ? (
                <span className="nav-button__count">{pending}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="agency-rail__footer">
        <div className="operator">
          <div className="operator__avatar">VF</div>
          <div>
            <div className="operator__name">Valentin Florez</div>
            <div className="operator__role">Founder · Solvers</div>
          </div>
        </div>
        <div className="live-row">
          <span className="live-dot" />
          {source === "supabase" ? "Supabase live" : "Fallback data"}
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({
  view,
  loading,
  onRefresh,
  onReview,
}: {
  view: ViewId;
  loading: boolean;
  onRefresh: () => void;
  onReview: () => void;
}) {
  return (
    <header className="workspace-header">
      <div>
        <div className="workspace-header__path">Solvers / Agency OS / {view}</div>
        <div className="workspace-header__title">Mission Control</div>
      </div>
      <div className="workspace-header__actions">
        <button className="icon-button" type="button" aria-label="Buscar">
          <Search size={15} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Actualizar datos"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
        </button>
        <button className="quiet-button" type="button" onClick={onReview}>
          <FileText size={14} aria-hidden="true" />
          Revisar drafts
        </button>
        <button className="primary-button" type="button" onClick={onReview}>
          <Plus size={14} aria-hidden="true" />
          Nueva captura
        </button>
      </div>
    </header>
  );
}

function MobileHeader({
  source,
  loading,
  onRefresh,
}: {
  source: LiveBundle["source"];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="mobile-header">
      <div className="wordmark">
        <div className="wordmark__mark">S</div>
        <div>
          <div className="wordmark__name">SOLVERS</div>
          <div className="wordmark__edition">Agency OS · 2.0</div>
        </div>
      </div>
      <button className="icon-button" onClick={onRefresh} disabled={loading} aria-label="Actualizar">
        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        <span className="sr-only">{source}</span>
      </button>
    </header>
  );
}

function MobileNav({
  view,
  onView,
  pending,
}: {
  view: ViewId;
  onView: (view: ViewId) => void;
  pending: number;
}) {
  return (
    <nav className="mobile-nav" aria-label="Navegación móvil">
      {nav.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            data-active={view === item.id}
            onClick={() => onView(item.id)}
            aria-label={`${item.label}${item.id === "review" && pending ? `, ${pending} pendientes` : ""}`}
          >
            <Icon size={18} strokeWidth={1.7} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ViewHeading({ view }: { view: ViewId }) {
  const copy = viewCopy[view];
  return (
    <div className="view-heading">
      <div>
        <div className="section-kicker">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
      </div>
      <p>{copy.description}</p>
    </div>
  );
}

function OperatingHorizon({ data, weeklyPct }: { data: LiveBundle; weeklyPct: number }) {
  return (
    <section className="operating-horizon" aria-labelledby="operating-horizon-title">
      <div className="operating-horizon__top">
        <div className="horizon-thesis">
          <div>
            <div className="section-kicker">Execution pulse · this week</div>
            <div className="horizon-thesis__copy" id="operating-horizon-title">
              {weeklyPct}% <span>de la semana está ejecutada.</span>
            </div>
          </div>
          <p className="horizon-thesis__note">
            El cuello de botella no es crear ideas. Es convertir capturas reales en drafts aprobados.
          </p>
        </div>
        <div className="horizon-data">
          <HorizonChart data={data.sparkFollowers} label="Audiencia · últimas 12 capturas" />
          <div className="horizon-metrics">
            {data.statusCards.map((metric, index) => (
              <div className="horizon-metric" key={metric.label}>
                <div className="horizon-metric__label">{metric.label}</div>
                <div className="horizon-metric__value">{metric.value}</div>
                <div className="horizon-metric__hint">{metric.hint}</div>
                {index === 0 ? (
                  <MicroLine data={data.sparkFollowers} inverse />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductionFlow({ data }: { data: LiveBundle }) {
  return (
    <div className="production-flow" role="list" aria-label="Pipeline de producción">
      {data.pipeline.map((stage, index) => (
        <div className="flow-stage" role="listitem" key={stage.id}>
          <div className="flow-stage__index">0{index + 1}</div>
          <div className="flow-stage__count">{stage.count}</div>
          <div className="flow-stage__label">{stage.label}</div>
          <span className="flow-stage__signal" data-tone={stage.tone} />
        </div>
      ))}
    </div>
  );
}

function WeeklySchedule({ data }: { data: LiveBundle }) {
  return (
    <div className="schedule-strip">
      {data.calendar.map((day) => (
        <div className="schedule-day" key={day.day}>
          <div className="schedule-day__label">{day.day}</div>
          <div className="schedule-day__counts">
            <div>
              <div className="schedule-day__number">{day.posts}</div>
              <div className="schedule-day__unit">posts</div>
            </div>
            <div>
              <div className="schedule-day__number">{day.replies}</div>
              <div className="schedule-day__unit">replies</div>
            </div>
          </div>
          <div className="schedule-day__focus">{day.focus}</div>
        </div>
      ))}
    </div>
  );
}

function Runway({ data }: { data: LiveBundle }) {
  return (
    <div className="runway-list">
      {data.scheduleSlots.map((slot) => (
        <div className="runway-item" key={slot.id}>
          <div className="runway-item__time">{slot.when}</div>
          <div>
            <div className="runway-item__title">{slot.title}</div>
            <div className="runway-item__channel">{slot.channel}</div>
          </div>
          <StatusLabel status={slot.status} />
        </div>
      ))}
    </div>
  );
}

function AreaRows({ data }: { data: LiveBundle }) {
  return (
    <div className="area-list">
      {data.areas.map((area) => {
        const pct = Math.min(100, Math.round((area.doneThisWeek / Math.max(area.weeklyTarget, 1)) * 100));
        return (
          <div className="area-row" key={area.id}>
            <div className="area-row__code">{area.code}</div>
            <div>
              <div className="area-row__name">{area.name}</div>
              <div className="area-row__description">{area.description}</div>
            </div>
            <div className="area-row__priority">{area.priority}</div>
            <div className="progress-track" aria-label={`${pct}% completado`}>
              <div className="progress-value" style={{ width: `${pct}%` }} />
            </div>
            <div className="area-row__ratio">
              {area.doneThisWeek}/{area.weeklyTarget}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommandView({ data, weeklyPct }: { data: LiveBundle; weeklyPct: number }) {
  return (
    <>
      <ViewHeading view="command" />
      <OperatingHorizon data={data} weeklyPct={weeklyPct} />

      <section className="agency-section">
        <SectionHeading
          meta="Throughput"
          title="De realidad Solvers a distribución"
          action={<span className="section-heading__meta">6 stages · live</span>}
        />
        <ProductionFlow data={data} />
      </section>

      <section className="agency-section">
        <div className="agenda-grid">
          <div>
            <SectionHeading meta="Semana" title="Cadencia editorial" />
            <WeeklySchedule data={data} />
          </div>
          <div>
            <SectionHeading meta="Runway" title="Próximas salidas" />
            <Runway data={data} />
          </div>
        </div>
      </section>

      <section className="agency-section">
        <SectionHeading
          meta="Pilares"
          title="Cobertura de contenido"
          action={<span className="section-heading__meta">target semanal</span>}
        />
        <AreaRows data={data} />
      </section>
    </>
  );
}

function ProductionView({ data }: { data: LiveBundle }) {
  const capture = data.pipeline.find((stage) => stage.id === "capture")?.count || 0;
  const posted = data.pipeline.find((stage) => stage.id === "posted")?.count || 0;
  return (
    <>
      <ViewHeading view="production" />
      <section className="operating-horizon">
        <div className="operating-horizon__top">
          <div className="horizon-thesis">
            <div>
              <div className="section-kicker">Factory velocity</div>
              <div className="horizon-thesis__copy">
                {posted} salidas <span>desde {capture} capturas.</span>
              </div>
            </div>
            <p className="horizon-thesis__note">
              La fábrica gana cuando el aprendizaje del día entra al sistema antes de que se enfríe.
            </p>
          </div>
          <div className="horizon-data">
            <HorizonChart data={data.sparkEngagement} label="Señal de engagement" />
            <div className="horizon-metrics">
              {data.pipeline.slice(0, 4).map((metric) => (
                <div className="horizon-metric" key={metric.id}>
                  <div className="horizon-metric__label">{metric.label}</div>
                  <div className="horizon-metric__value">{metric.count}</div>
                  <div className="horizon-metric__hint">current queue</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="agency-section">
        <SectionHeading meta="Pipeline" title="Flujo de trabajo" />
        <ProductionFlow data={data} />
      </section>

      <section className="agency-section">
        <SectionHeading meta="Coverage" title="Áreas que alimentan la fábrica" />
        <AreaRows data={data} />
      </section>
    </>
  );
}

function CalendarView({ data }: { data: LiveBundle }) {
  const totalPosts = data.calendar.reduce((sum, day) => sum + day.posts, 0);
  const totalReplies = data.calendar.reduce((sum, day) => sum + day.replies, 0);
  return (
    <>
      <ViewHeading view="calendar" />
      <section className="operating-horizon">
        <div className="operating-horizon__top">
          <div className="horizon-thesis">
            <div>
              <div className="section-kicker">Editorial runway</div>
              <div className="horizon-thesis__copy">
                {totalPosts} posts <span>+ {totalReplies} replies.</span>
              </div>
            </div>
            <p className="horizon-thesis__note">
              La cadencia objetivo es 5 posts core y 15 replies de valor por semana.
            </p>
          </div>
          <div className="horizon-data">
            <HorizonChart data={data.sparkPosts} label="Cadencia de publicación" />
            <div className="horizon-metrics">
              {data.weeklyGoals.map((goal) => (
                <div className="horizon-metric" key={goal.label}>
                  <div className="horizon-metric__label">{goal.label}</div>
                  <div className="horizon-metric__value">
                    {goal.current}/{goal.target}
                  </div>
                  <div className="horizon-metric__hint">week target</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="agency-section">
        <SectionHeading meta="Week 28" title="Mapa de distribución" />
        <WeeklySchedule data={data} />
      </section>

      <section className="agency-section">
        <SectionHeading meta="Queue" title="Programación y bloqueos" />
        <Runway data={data} />
      </section>
    </>
  );
}

function ReviewView({
  data,
  selectedId,
  onSelect,
  busyId,
  onStatus,
}: {
  data: LiveBundle;
  selectedId: string | null;
  onSelect: (id: string) => void;
  busyId: string | null;
  onStatus: (id: string, status: string) => Promise<void>;
}) {
  const selected = data.drafts.find((draft) => draft.id === selectedId) || data.drafts[0];
  return (
    <>
      <ViewHeading view="review" />
      {selected ? (
        <section className="review-layout">
          <div className="review-list">
            <div className="section-kicker">Inbox · {data.drafts.length}</div>
            <div className="mt-4 grid gap-2">
              {data.drafts.map((draft) => (
                <button
                  className="review-list__item"
                  data-active={selected.id === draft.id}
                  key={draft.id}
                  onClick={() => onSelect(draft.id)}
                  type="button"
                >
                  <StatusLabel status={draft.status} />
                  <div className="review-list__title">{draft.title}</div>
                  <div className="mt-2 font-mono text-[9px] text-neutral-600">
                    {draft.area} · score {draft.score}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <article className="review-editor">
            <div className="flex flex-wrap items-center gap-4">
              <StatusLabel status={selected.status} />
              <span className="section-kicker">{selected.language}</span>
              <span className="section-kicker">{selected.area}</span>
            </div>
            <h2 className="review-editor__headline">{selected.title}</h2>
            <p className="review-editor__body">{selected.preview}</p>
            <div className="review-editor__score">
              <span>Publish readiness</span>
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${Math.min(100, selected.score)}%` }} />
              </div>
              <strong>{selected.score}/100</strong>
            </div>
            <div className="review-editor__actions">
              <button
                className="primary-button"
                disabled={busyId === selected.id}
                onClick={() => onStatus(selected.id, "approved")}
                type="button"
              >
                <Check size={15} />
                Aprobar y mover a calendario
              </button>
              <button
                className="quiet-button"
                disabled={busyId === selected.id}
                onClick={() => onStatus(selected.id, "pending")}
                type="button"
              >
                <MessageSquareText size={15} />
                Pedir cambios
              </button>
              <button
                className="icon-button"
                disabled={busyId === selected.id}
                onClick={() => onStatus(selected.id, "rejected")}
                type="button"
                aria-label="Descartar draft"
              >
                <X size={15} />
              </button>
            </div>
          </article>
        </section>
      ) : (
        <section className="operating-horizon p-12 text-center">
          <FileText className="mx-auto text-neutral-600" size={28} />
          <h2 className="mt-4 text-lg font-semibold">No hay drafts en revisión</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Envía una captura real de Solvers para alimentar la fábrica.
          </p>
        </section>
      )}
    </>
  );
}

function SystemsView({ data }: { data: LiveBundle }) {
  const integrations = [
    { name: "X", state: "@valentinflrz", icon: Radio },
    { name: "xurl", state: "authenticated", icon: Zap },
    { name: "Hermes", state: "operator online", icon: Bot },
    { name: "Supabase", state: data.source === "supabase" ? "live" : "fallback", icon: CircleDot },
    { name: "Vercel", state: "production", icon: Command },
  ];
  return (
    <>
      <ViewHeading view="systems" />
      <section className="agency-section mt-0 border-t-0 pt-0">
        <SectionHeading meta="Infrastructure" title="Live operating chain" />
        <div className="integration-map">
          {integrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div className="integration-node" key={integration.name}>
                <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
                <div className="integration-node__name">{integration.name}</div>
                <div className="integration-node__state">{integration.state}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="agency-section">
        <SectionHeading
          meta="Automation policy"
          title="Loops autónomos"
          action={<StatusLabel status="pending">Auto-post OFF</StatusLabel>}
        />
        <div className="system-list">
          {data.automations.map((automation) => (
            <div className="system-row" key={automation.id}>
              <div className="system-row__name">{automation.name}</div>
              <div className="system-row__description">{automation.desc}</div>
              <div className="system-row__cadence">{automation.cadence}</div>
              <div className="toggle" data-enabled={automation.enabled} aria-label={automation.enabled ? "Activo" : "Inactivo"} />
            </div>
          ))}
        </div>
      </section>

      <section className="agency-section">
        <SectionHeading meta="Safety" title="Reglas de publicación" />
        <div className="system-list">
          {[
            ["Approve gate", "Todo draft requiere aprobación humana", "ON"],
            ["Auto-post", "Bloqueado hasta estabilizar tono y métricas", "OFF"],
            ["Credentials", "Tokens fuera de chat y fuera del repo", "SAFE"],
          ].map(([name, description, state]) => (
            <div className="system-row" key={name}>
              <div className="system-row__name">{name}</div>
              <div className="system-row__description">{description}</div>
              <div />
              <StatusLabel status={state === "OFF" ? "pending" : "live"}>{state}</StatusLabel>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ContextRail({
  data,
  onReview,
}: {
  data: LiveBundle;
  onReview: () => void;
}) {
  const pendingDraft = data.drafts.find((draft) => draft.status === "pending");
  const now = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "America/Bogota",
      }).format(new Date()),
    [],
  );

  return (
    <aside className="context-rail" aria-label="Acciones y contexto">
      <div className="context-heading">
        <div className="context-heading__title">Action stack</div>
        <div className="context-heading__date">{now}</div>
      </div>

      <div className="next-action">
        <div className="next-action__label">Next leverage move</div>
        <div className="next-action__title">
          {pendingDraft ? "Desbloquea el próximo post." : "Alimenta la fábrica."}
        </div>
        <div className="next-action__copy">
          {pendingDraft
            ? `El draft “${pendingDraft.title}” ya está listo para tu criterio.`
            : "No hay drafts pendientes. Envía una captura real de Solvers."}
        </div>
        <button className="next-action__button" type="button" onClick={onReview}>
          <span>{pendingDraft ? "Ir a revisión" : "Crear captura"}</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="context-block">
        <div className="context-block__title">Hoy</div>
        {data.scheduleSlots.slice(0, 3).map((slot, index) => (
          <div className="context-task" key={slot.id}>
            <div className="context-task__index">0{index + 1}</div>
            <div>
              <div className="context-task__title">{slot.title}</div>
              <div className="context-task__meta">{slot.when}</div>
            </div>
            <StatusLabel status={slot.status}>
              <span className="sr-only">{statusCopy(slot.status)}</span>
            </StatusLabel>
          </div>
        ))}
      </div>

      <div className="context-block">
        <div className="context-block__title">System pulse</div>
        <div className="context-stat">
          <span>Data source</span>
          <strong>{data.source}</strong>
        </div>
        <div className="context-stat">
          <span>Approve gate</span>
          <strong>ON</strong>
        </div>
        <div className="context-stat">
          <span>Auto-post</span>
          <strong>OFF</strong>
        </div>
        <div className="context-stat">
          <span>Followers</span>
          <strong>{data.account.followers}</strong>
        </div>
      </div>

      <div className="context-block">
        <div className="context-block__title">Weekly completion</div>
        <div className="mt-4 flex items-center justify-center">
          <ArcGauge
            value={Math.round(
              (data.weeklyGoals.reduce((sum, goal) => sum + goal.current / Math.max(goal.target, 1), 0) /
                Math.max(data.weeklyGoals.length, 1)) *
                100,
            )}
          />
        </div>
      </div>
    </aside>
  );
}

export default function MissionControlPage() {
  const [view, setView] = useState<ViewId>("command");
  const [data, setData] = useState<LiveBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/mc/live", { cache: "no-store" });
      if (!response.ok) throw new Error(`No se pudo cargar data live (${response.status})`);
      const next = (await response.json()) as LiveBundle;
      setData(next);
      setSelectedDraftId((current) => current || next.drafts[0]?.id || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar Mission Control");
      setData((current) => current || fallbackBundle());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const live = data || fallbackBundle();
  const pending = useMemo(
    () => live.drafts.filter((draft) => draft.status === "pending").length,
    [live.drafts],
  );
  const weeklyPct = Math.round(
    (live.weeklyGoals.reduce((sum, goal) => sum + goal.current / Math.max(goal.target, 1), 0) /
      Math.max(live.weeklyGoals.length, 1)) *
      100,
  );

  async function setDraftStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/mc/drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `No se pudo actualizar (${response.status})`);
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el draft");
    } finally {
      setBusyId(null);
    }
  }

  function goReview() {
    setView("review");
  }

  return (
    <div className="agency-shell">
      <AgencyRail view={view} onView={setView} pending={pending} source={live.source} />

      <section className="workspace">
        <MobileHeader source={live.source} loading={loading} onRefresh={refresh} />
        <WorkspaceHeader
          view={view}
          loading={loading}
          onRefresh={refresh}
          onReview={goReview}
        />

        <main className="workspace-content">
          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button className="quiet-button" type="button" onClick={refresh}>
                Reintentar
              </button>
            </div>
          ) : null}

          {loading && !data ? (
            <div className="loading-shell" aria-label="Cargando Mission Control">
              <div className="loading-block" />
              <div className="loading-block" />
            </div>
          ) : (
            <>
              {view === "command" ? <CommandView data={live} weeklyPct={weeklyPct} /> : null}
              {view === "production" ? <ProductionView data={live} /> : null}
              {view === "calendar" ? <CalendarView data={live} /> : null}
              {view === "review" ? (
                <ReviewView
                  data={live}
                  selectedId={selectedDraftId}
                  onSelect={setSelectedDraftId}
                  busyId={busyId}
                  onStatus={setDraftStatus}
                />
              ) : null}
              {view === "systems" ? <SystemsView data={live} /> : null}

              <div className="mobile-context">
                <section className="agency-section">
                  <SectionHeading meta="Action stack" title="Lo que desbloquea la semana" />
                  <button className="primary-button" type="button" onClick={goReview}>
                    <Sparkles size={14} />
                    Revisar {pending} draft{pending === 1 ? "" : "s"}
                  </button>
                </section>
              </div>
            </>
          )}
        </main>
      </section>

      <ContextRail data={live} onReview={goReview} />
      <MobileNav view={view} onView={setView} pending={pending} />
    </div>
  );
}
