"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { ArcGauge, HorizonChart, MicroLine } from "@/components/agency-charts";
import { LogoutButton } from "@/components/logout-button";
import {
  FactoryCalendarPanel,
  FactoryProductionPanel,
  FactoryReviewPanel,
  FactorySystemsPanel,
} from "@/components/factory-workspace";
import type { LiveBundle } from "@/lib/live";
import { emptyFactorySnapshot } from "@/lib/factory/types";
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
    factory: emptyFactorySnapshot,
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
        <LogoutButton />
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
        <LogoutButton variant="compact" />
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
      <div className="mobile-header__actions">
        <button className="icon-button" onClick={onRefresh} disabled={loading} aria-label="Actualizar">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span className="sr-only">{source}</span>
        </button>
        <LogoutButton variant="compact" />
      </div>
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

function ContextRail({
  data,
  onReview,
}: {
  data: LiveBundle;
  onReview: () => void;
}) {
  const pendingDraft = data.drafts.find((draft) =>
    ["pending", "draft", "in_review", "changes_requested"].includes(draft.status),
  );
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

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/mc/live", { cache: "no-store" });
      if (!response.ok) throw new Error(`No se pudo cargar data live (${response.status})`);
      const next = (await response.json()) as LiveBundle;
      setData(next);
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
  const pending = live.factory.counts.draftsReview;
  const weeklyPct = Math.round(
    (live.weeklyGoals.reduce((sum, goal) => sum + goal.current / Math.max(goal.target, 1), 0) /
      Math.max(live.weeklyGoals.length, 1)) *
      100,
  );

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
              {view === "production" ? (
                <>
                  <ViewHeading view="production" />
                  <FactoryProductionPanel data={live.factory} onChanged={refresh} />
                </>
              ) : null}
              {view === "calendar" ? (
                <>
                  <ViewHeading view="calendar" />
                  <FactoryCalendarPanel data={live.factory} onChanged={refresh} />
                </>
              ) : null}
              {view === "review" ? (
                <>
                  <ViewHeading view="review" />
                  <FactoryReviewPanel data={live.factory} onChanged={refresh} />
                </>
              ) : null}
              {view === "systems" ? (
                <>
                  <ViewHeading view="systems" />
                  <FactorySystemsPanel data={live.factory} onChanged={refresh} />
                </>
              ) : null}

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
