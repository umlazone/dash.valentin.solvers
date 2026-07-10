"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  FlaskConical,
  Inbox,
  LoaderCircle,
  Plus,
  Radar,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { factoryRequest } from "@/lib/factory/client";
import type { FactorySnapshot } from "@/lib/factory/types";

function mechanismLabel(value: string | null) {
  const words = (value || "Mecanismo por clasificar").replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Mecanismo por clasificar";
}

function FactoryState({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className="factory-state" data-tone={tone}>
      {children}
    </span>
  );
}

function FactoryEmpty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="factory-empty">
      <Inbox size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null;
  return (
    <div className="factory-feedback" data-error={Boolean(error)} role={error ? "alert" : "status"}>
      {error || success}
    </div>
  );
}

type CommonProps = {
  data: FactorySnapshot;
  onChanged: () => Promise<void>;
};

export function FactoryProductionPanel({ data, onChanged }: CommonProps) {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [captureType, setCaptureType] = useState("case");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [visibleSignals, setVisibleSignals] = useState(6);

  async function run(key: string, task: () => Promise<unknown>, message: string) {
    setBusy(key);
    setError("");
    setSuccess("");
    try {
      await task();
      await onChanged();
      setSuccess(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la acción");
    } finally {
      setBusy("");
    }
  }

  async function createCapture(event: React.FormEvent) {
    event.preventDefault();
    await run(
      "capture",
      async () => {
        await factoryRequest("/api/mc/captures", "POST", {
          title,
          rawText,
          captureType,
          language: "ES",
        });
        setTitle("");
        setRawText("");
      },
      "Captura añadida al inbox.",
    );
  }

  async function draftFromCapture(captureId: string, captureTitle: string, body: string) {
    await run(
      `capture-${captureId}`,
      () =>
        factoryRequest("/api/mc/drafts", "POST", {
          title: captureTitle,
          body,
          captureId,
          contentType: "post",
          language: "ES",
        }),
      "Borrador creado; ya está en Revisión.",
    );
  }

  async function signalAction(id: string, status: string) {
    await run(
      `signal-${id}`,
      () => factoryRequest("/api/mc/signals", "PATCH", { id, status }),
      status === "shortlisted" ? "Señal priorizada." : "Señal descartada.",
    );
  }

  async function draftFromSignal(signal: FactorySnapshot["signals"][number]) {
    const source = signal.solversAngle || signal.mechanism || signal.sourceText || "Señal de research";
    await run(
      `draft-signal-${signal.id}`,
      () =>
        factoryRequest("/api/mc/drafts", "POST", {
          title: `Solvers angle · ${signal.mechanism || signal.sourceAuthor || "research"}`,
          body: source,
          signalId: signal.id,
          contentType: signal.contentFormat || "post",
          language: signal.language,
          score: signal.score,
        }),
      "Señal convertida en borrador.",
    );
  }

  const latestRun = data.researchRuns[0];
  return (
    <div className="factory-stack">
      <Feedback error={error} success={success} />
      <section className="factory-split">
        <form className="factory-composer" onSubmit={createCapture}>
          <div className="factory-section-heading">
            <div>
              <span>CAPTURE / INPUT</span>
              <h2>Algo real pasó en Solvers.</h2>
            </div>
            <Plus size={18} />
          </div>
          <label>
            <span>Título operativo</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. El handoff que nos costó dos días" required />
          </label>
          <label>
            <span>Qué pasó / números / fricción</span>
            <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Escribe en bruto. La fábrica ordena después." rows={7} required />
          </label>
          <div className="factory-form-row">
            <label>
              <span>Tipo</span>
              <select value={captureType} onChange={(event) => setCaptureType(event.target.value)}>
                <option value="case">Caso</option>
                <option value="roadblock">Roadblock</option>
                <option value="win">Win</option>
                <option value="close">Cierre</option>
                <option value="tool">Tool</option>
                <option value="playbook">Playbook</option>
                <option value="question">Pregunta</option>
                <option value="note">Nota</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={busy === "capture"}>
              {busy === "capture" ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={14} />}
              Guardar captura
            </button>
          </div>
        </form>

        <div className="factory-panel">
          <div className="factory-section-heading">
            <div>
              <span>INBOX / {data.captures.length}</span>
              <h2>Capturas por convertir</h2>
            </div>
            <Inbox size={18} />
          </div>
          <div className="factory-card-list">
            {data.captures.length ? (
              data.captures.slice(0, 10).map((capture) => (
                <article className="factory-card" key={capture.id}>
                  <div className="factory-card__meta">
                    <FactoryState tone={capture.status === "new" ? "warn" : "neutral"}>{capture.status}</FactoryState>
                    <span>{capture.captureType}</span>
                    <span>{new Date(capture.capturedAt).toLocaleDateString("es-CO")}</span>
                  </div>
                  <h3>{capture.title}</h3>
                  <p>{capture.rawText}</p>
                  {capture.status !== "drafted" ? (
                    <button className="quiet-button" type="button" disabled={busy === `capture-${capture.id}`} onClick={() => draftFromCapture(capture.id, capture.title, capture.rawText)}>
                      <FilePenLine size={14} /> Crear borrador
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <FactoryEmpty title="Inbox vacío" copy="Crea una captura con una situación real, no una idea genérica." />
            )}
          </div>
        </div>
      </section>

      <section className="factory-panel">
        <div className="factory-section-heading">
          <div>
            <span>GROK RESEARCH / 4H</span>
            <h2>Señales con mecanismo, no copias.</h2>
          </div>
          <div className="factory-run-meta">
            <Radar size={17} />
            {latestRun ? `${latestRun.status} · ${latestRun.signalCount} señales` : "Primer run pendiente"}
          </div>
        </div>
        <div className="research-grid">
          {data.signals.length ? (
            data.signals.slice(0, visibleSignals).map((signal) => (
              <article className="research-card" key={signal.id}>
                <div className="factory-card__meta">
                  <FactoryState tone={signal.score >= 80 ? "good" : signal.score >= 65 ? "warn" : "neutral"}>{signal.score}</FactoryState>
                  <span>{signal.sourceAuthor ? `@${signal.sourceAuthor.replace(/^@/, "")}` : "X"}</span>
                  <span>{signal.status}</span>
                </div>
                <h3>{mechanismLabel(signal.mechanism)}</h3>
                <p>{signal.solversAngle || signal.sourceText || "Sin ángulo todavía."}</p>
                <div className="research-card__actions">
                  {signal.sourceUrl ? (
                    <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="icon-button" aria-label="Abrir fuente">
                      <ExternalLink size={13} />
                    </a>
                  ) : null}
                  <button className="quiet-button" type="button" onClick={() => signalAction(signal.id, "shortlisted")}>
                    <Sparkles size={13} /> Priorizar
                  </button>
                  <button className="primary-button" type="button" onClick={() => draftFromSignal(signal)}>
                    <FilePenLine size={13} /> Draft
                  </button>
                  <button className="icon-button" type="button" onClick={() => signalAction(signal.id, "dismissed")} aria-label="Descartar señal">
                    <X size={13} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <FactoryEmpty title="Research aún vacío" copy="El job Grok/X añadirá señales originales cada cuatro horas." />
          )}
        </div>
        {visibleSignals < data.signals.length ? (
          <button
            className="factory-more-button"
            type="button"
            onClick={() => setVisibleSignals((count) => count + 6)}
          >
            Ver {Math.min(6, data.signals.length - visibleSignals)} señales más
          </button>
        ) : null}
      </section>
    </div>
  );
}

export function FactoryReviewPanel({ data, onChanged }: CommonProps) {
  const candidates = useMemo(
    () => data.drafts.filter((draft) => !["archived", "published"].includes(draft.status)),
    [data.drafts],
  );
  const [selectedId, setSelectedId] = useState(candidates[0]?.id || "");
  const selected = candidates.find((draft) => draft.id === selectedId) || candidates[0];
  const [title, setTitle] = useState(selected?.title || "");
  const [body, setBody] = useState(selected?.body || "");
  const [changeRequest, setChangeRequest] = useState("");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setTitle(selected.title);
    setBody(selected.body);
    setChangeRequest(selected.changeRequest || "");
  }, [selected]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    setBusy(action);
    setError("");
    setSuccess("");
    try {
      await factoryRequest("/api/mc/drafts", "PATCH", {
        id: selected.id,
        action,
        expectedVersion: selected.version,
        title,
        body,
        changeRequest,
        ...extra,
      });
      await onChanged();
      setSuccess(`Draft: ${action} confirmado.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el draft");
    } finally {
      setBusy("");
    }
  }

  async function scheduleDraft() {
    if (!selected || !schedule) return;
    setBusy("schedule");
    setError("");
    try {
      await factoryRequest("/api/mc/schedule", "POST", {
        draftId: selected.id,
        scheduledFor: new Date(schedule).toISOString(),
      });
      await onChanged();
      setSuccess("Publicación añadida al calendario en modo dry-run.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo programar");
    } finally {
      setBusy("");
    }
  }

  if (!selected) {
    return <FactoryEmpty title="No hay drafts" copy="Crea uno desde una captura o una señal de research." />;
  }

  return (
    <div className="factory-stack">
      <Feedback error={error} success={success} />
      <section className="review-layout factory-review-layout">
        <div className="review-list">
          <div className="section-kicker">DRAFT STUDIO · {candidates.length}</div>
          <div className="factory-card-list">
            {candidates.map((draft) => (
              <button className="review-list__item" data-active={draft.id === selected.id} key={draft.id} onClick={() => setSelectedId(draft.id)} type="button">
                <FactoryState tone={draft.status === "approved" ? "good" : draft.status === "changes_requested" ? "bad" : "warn"}>{draft.status}</FactoryState>
                <div className="review-list__title">{draft.title}</div>
                <div className="factory-card__meta"><span>v{draft.version}</span><span>{draft.language}</span><span>score {draft.score}</span></div>
              </button>
            ))}
          </div>
        </div>
        <article className="review-editor factory-editor">
          <div className="factory-editor__bar">
            <FactoryState tone={selected.status === "approved" ? "good" : "warn"}>{selected.status}</FactoryState>
            <span>v{selected.version}</span>
            <span>{body.length} chars</span>
          </div>
          <label>
            <span>Título interno</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>Texto final para X</span>
            <textarea className="factory-draft-textarea" value={body} onChange={(event) => setBody(event.target.value)} rows={13} />
          </label>
          {selected.status === "changes_requested" ? (
            <div className="change-request"><strong>Cambios pedidos</strong><span>{selected.changeRequest}</span></div>
          ) : null}
          <div className="factory-editor__actions">
            <button className="quiet-button" type="button" disabled={Boolean(busy)} onClick={() => act("save")}><Save size={14} /> Guardar</button>
            {["draft", "changes_requested", "rejected"].includes(selected.status) ? (
              <button className="primary-button" type="button" disabled={Boolean(busy)} onClick={() => act("submit_review")}><Send size={14} /> Enviar a revisión</button>
            ) : null}
            {selected.status === "in_review" ? (
              <button className="primary-button" type="button" disabled={Boolean(busy)} onClick={() => act("approve")}><Check size={14} /> Aprobar</button>
            ) : null}
          </div>
          {selected.status === "in_review" || selected.status === "approved" ? (
            <div className="factory-change-row">
              <input value={changeRequest} onChange={(event) => setChangeRequest(event.target.value)} placeholder="Cambio concreto: abre con el número, quita hype…" />
              <button className="quiet-button" type="button" disabled={!changeRequest.trim() || Boolean(busy)} onClick={() => act("request_changes")}><FilePenLine size={14} /> Pedir cambios</button>
              <button className="icon-button" type="button" onClick={() => act("reject")} aria-label="Rechazar draft"><Archive size={14} /></button>
            </div>
          ) : null}
          {selected.status === "approved" ? (
            <div className="factory-schedule-row">
              <label><span>Fecha y hora</span><input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label>
              <button className="primary-button" type="button" disabled={!schedule || Boolean(busy)} onClick={scheduleDraft}><CalendarClock size={14} /> Programar</button>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}

export function FactoryCalendarPanel({ data, onChanged }: CommonProps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const drafts = new Map(data.drafts.map((draft) => [draft.id, draft]));

  async function dryRun(id: string) {
    setBusy(id);
    setError("");
    setSuccess("");
    try {
      await factoryRequest("/api/mc/publications/dry-run", "POST", { publicationId: id });
      await onChanged();
      setSuccess("Dry-run limpio. Repite hasta 3/3 para dejarlo ready.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dry-run falló");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="factory-stack">
      <Feedback error={error} success={success} />
      <section className="factory-kpis">
        <div><span>Queue</span><strong>{data.counts.scheduled}</strong></div>
        <div><span>Ready</span><strong>{data.publications.filter((item) => item.status === "ready").length}</strong></div>
        <div><span>Published</span><strong>{data.counts.published}</strong></div>
        <div><span>Mode</span><strong>{String(data.settings.publisher_mode || "dry_run")}</strong></div>
      </section>
      <section className="factory-panel">
        <div className="factory-section-heading"><div><span>PUBLISHER QUEUE</span><h2>Agenda, gates y dry-runs</h2></div><FlaskConical size={18} /></div>
        <div className="publication-table">
          {data.publications.length ? data.publications.map((publication) => {
            const draft = drafts.get(publication.draftId);
            return (
              <article className="publication-row" key={publication.id}>
                <div className="publication-row__date"><strong>{new Date(publication.scheduledFor).toLocaleDateString("es-CO", { month: "short", day: "numeric" })}</strong><span>{new Date(publication.scheduledFor).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div><h3>{draft?.title || "Draft"}</h3><p>{draft?.body.slice(0, 150)}</p></div>
                <div className="publication-row__gate"><FactoryState tone={publication.status === "ready" || publication.status === "published" ? "good" : "warn"}>{publication.status}</FactoryState><span>dry-run {publication.dryRunCount}/3</span></div>
                {!["published", "publishing", "cancelled"].includes(publication.status) && publication.dryRunCount < 3 ? (
                  <button className="quiet-button" type="button" disabled={busy === publication.id} onClick={() => dryRun(publication.id)}>{busy === publication.id ? <LoaderCircle className="animate-spin" size={14} /> : <FlaskConical size={14} />} Validar</button>
                ) : <CheckCircle2 size={18} className="factory-good" />}
              </article>
            );
          }) : <FactoryEmpty title="Agenda vacía" copy="Aprueba un draft y programa fecha/hora desde Revisión." />}
        </div>
      </section>
    </div>
  );
}

export function FactorySystemsPanel({ data, onChanged }: CommonProps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function setting(key: string, value: unknown) {
    setBusy(key);
    setError("");
    try {
      await factoryRequest("/api/mc/settings", "PATCH", { key, value });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el setting");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="factory-stack">
      <Feedback error={error} success="" />
      <section className="factory-panel">
        <div className="factory-section-heading"><div><span>AUTOMATION CONTROL</span><h2>Loops con gates visibles</h2></div><Radar size={18} /></div>
        <div className="settings-grid">
          <div className="setting-card"><span>Research Grok/X</span><strong>{data.settings.research_enabled ? "ON" : "OFF"}</strong><p>Cada {String(data.settings.research_cadence_hours || 4)} horas. Solo señales y drafts; nunca publica.</p><button className="quiet-button" disabled={busy === "research_enabled"} onClick={() => setting("research_enabled", !data.settings.research_enabled)}>{data.settings.research_enabled ? "Pausar" : "Activar"}</button></div>
          <div className="setting-card"><span>Publisher</span><strong>{String(data.settings.publisher_mode || "dry_run")}</strong><p>Requiere aprobación, snapshot intacto y tres validaciones.</p><button className="quiet-button" disabled={busy === "publisher_mode"} onClick={() => setting("publisher_mode", data.settings.publisher_mode === "live" ? "dry_run" : "live")}>Cambiar modo</button></div>
          <div className="setting-card" data-danger={Boolean(data.settings.kill_switch)}><span>Kill switch</span><strong>{data.settings.kill_switch ? "STOP" : "ARMED"}</strong><p>Bloquea cualquier salida real aunque exista cola ready.</p><button className="quiet-button" disabled={busy === "kill_switch"} onClick={() => setting("kill_switch", !data.settings.kill_switch)}>{data.settings.kill_switch ? "Rearmar" : "Detener"}</button></div>
          <div className="setting-card"><span>Auto-publish</span><strong>{data.settings.publisher_enabled ? "ON" : "OFF"}</strong><p>OFF por defecto. El launch gate exige live + 3 dry-runs.</p><button className="quiet-button" disabled={busy === "publisher_enabled"} onClick={() => setting("publisher_enabled", !data.settings.publisher_enabled)}>{data.settings.publisher_enabled ? "Apagar" : "Intentar activar"}</button></div>
        </div>
      </section>
      <section className="factory-panel">
        <div className="factory-section-heading"><div><span>RESEARCH HISTORY</span><h2>Últimos runs</h2></div><Sparkles size={18} /></div>
        <div className="research-run-list">
          {data.researchRuns.length ? data.researchRuns.map((run) => (
            <article key={run.id}><FactoryState tone={run.status === "completed" ? "good" : run.status === "failed" ? "bad" : "warn"}>{run.status}</FactoryState><div><strong>{run.model || "Grok"}</strong><p>{run.summary || "Sin resumen"}</p></div><div><strong>{run.signalCount}</strong><span>señales</span></div><time>{new Date(run.startedAt).toLocaleString("es-CO")}</time></article>
          )) : <FactoryEmpty title="Sin runs todavía" copy="El scheduler de Hermes registrará aquí cada investigación." />}
        </div>
      </section>
    </div>
  );
}
