export type DraftStatus = "pending" | "approved" | "posted" | "rejected";

export type ContentArea = {
  id: string;
  code: string;
  name: string;
  description: string;
  priority: "core" | "growth" | "support";
  weeklyTarget: number;
  doneThisWeek: number;
};

export const account = {
  handle: "@valentinflrz",
  name: "Valentin Florez",
  bio: "Agentic operations studio. Agents do the work. We build the systems.",
  plan: "X Premium",
  followers: 321,
  following: 188,
  tweets: 8099,
  likes: 3024,
  language: "ES default · EN selectivo",
  objective90d: "Mix: marca + leads alto ticket Solvers",
};

export const statusCards = [
  { label: "Followers", value: "321", hint: "+12 / 30d", delta: 3.8 },
  { label: "Drafts pending", value: "1", hint: "approve gate ON", delta: 0 },
  { label: "Posted 7d", value: "2", hint: "target 7", delta: -40 },
  { label: "Replies 7d", value: "4", hint: "target 15", delta: -20 },
];

/** Mock series for sparkline — will later come from X metrics / Supabase */
export const sparkFollowers = [280, 286, 290, 295, 298, 301, 305, 310, 312, 315, 318, 321];
export const sparkEngagement = [12, 18, 9, 22, 14, 30, 11, 25, 19, 28, 16, 24];
export const sparkPosts = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1];

export const pipeline = [
  { id: "capture", label: "Capturas", count: 3, tone: "neutral" as const },
  { id: "scout", label: "Scout", count: 8, tone: "neutral" as const },
  { id: "draft", label: "Drafts", count: 1, tone: "warn" as const },
  { id: "approved", label: "Aprobados", count: 0, tone: "good" as const },
  { id: "scheduled", label: "Programados", count: 0, tone: "neutral" as const },
  { id: "posted", label: "Publicados", count: 2, tone: "good" as const },
];

export const funnel = [
  { stage: "Impresiones 7d", value: 4200, pct: 100 },
  { stage: "Engagements", value: 186, pct: 44 },
  { stage: "Profile visits", value: 52, pct: 28 },
  { stage: "DMs / replies calif.", value: 6, pct: 12 },
  { stage: "Leads high-ticket", value: 1, pct: 6 },
];

export const areas: ContentArea[] = [
  {
    id: "a1",
    code: "A1",
    name: "Solvers en la calle",
    description: "Casos reales del studio: antes → fricción → sistema → después.",
    priority: "core",
    weeklyTarget: 2,
    doneThisWeek: 0,
  },
  {
    id: "a2",
    code: "A2",
    name: "Roadblocks / no-aciertos",
    description: "Bloqueos y errores con lección usable.",
    priority: "core",
    weeklyTarget: 1,
    doneThisWeek: 0,
  },
  {
    id: "a3",
    code: "A3",
    name: "Middleware aburrido",
    description: "Donde está la plata: copy-paste, listings, glue.",
    priority: "core",
    weeklyTarget: 1,
    doneThisWeek: 1,
  },
  {
    id: "a4",
    code: "A4",
    name: "Cierre alto ticket",
    description: "Calificación y cierre sin postureo.",
    priority: "growth",
    weeklyTarget: 1,
    doneThisWeek: 0,
  },
  {
    id: "a5",
    code: "A5",
    name: "Tools con criterio",
    description: "Experiencia real con herramientas (qué sirve / qué quema).",
    priority: "growth",
    weeklyTarget: 1,
    doneThisWeek: 1,
  },
  {
    id: "a6",
    code: "A6",
    name: "Anti-hype + playbooks",
    description: "Takes con base + checklists que la gente guarda.",
    priority: "support",
    weeklyTarget: 1,
    doneThisWeek: 0,
  },
];

export const drafts = [
  {
    id: "d1",
    title: "La tool que me quemó la cuenta en un prompt",
    preview:
      "Una sola tool, un prompt, y se fue la cuenta. No fue el modelo. Fue el middleware con permisos de más…",
    status: "pending" as DraftStatus,
    language: "ES",
    area: "A5 Tools",
    source: "post real + reframe Solvers",
    updatedAt: "2026-07-09",
    score: 82,
  },
];

export const calendar = [
  { day: "Lun 7", posts: 0, replies: 2, focus: "Scout + replies" },
  { day: "Mar 8", posts: 1, replies: 1, focus: "Tool take" },
  { day: "Mié 9", posts: 0, replies: 1, focus: "Mission Control" },
  { day: "Jue 10", posts: 0, replies: 0, focus: "Caso Solvers (bloqueado)" },
  { day: "Vie 11", posts: 0, replies: 0, focus: "Roadblock draft" },
  { day: "Sáb 12", posts: 0, replies: 0, focus: "Light / optional" },
  { day: "Dom 13", posts: 1, replies: 0, focus: "Weekly recap" },
];

export const scheduleSlots = [
  {
    id: "s1",
    when: "Hoy · 18:00",
    title: "Tool que quemó la cuenta",
    status: "needs_approve" as const,
    channel: "X post",
  },
  {
    id: "s2",
    when: "Jue · 10:30",
    title: "Caso Solvers (falta captura)",
    status: "blocked" as const,
    channel: "X post",
  },
  {
    id: "s3",
    when: "Vie · 12:00",
    title: "Reply batch AI/ops (10)",
    status: "planned" as const,
    channel: "Replies",
  },
  {
    id: "s4",
    when: "Dom · 17:00",
    title: "Recap semanal factory",
    status: "planned" as const,
    channel: "X post",
  },
];

export const automations = [
  {
    id: "auto-pulse",
    name: "Daily pulse",
    desc: "Lee likes/timeline + propone 1–3 piezas",
    enabled: false,
    cadence: "cada día 08:30",
  },
  {
    id: "auto-scout",
    name: "Creator scout",
    desc: "Mecanismos de 8–15 creators → signal cards",
    enabled: false,
    cadence: "3× semana",
  },
  {
    id: "auto-draft",
    name: "Draft factory",
    desc: "De capturas → drafts en tu voz",
    enabled: true,
    cadence: "on capture",
  },
  {
    id: "auto-post",
    name: "Auto-publish",
    desc: "Publica cola approved vía xurl",
    enabled: false,
    cadence: "OFF hasta estable",
  },
];

export const weeklyGoals = [
  { label: "Posts core", current: 2, target: 5 },
  { label: "Replies valor", current: 4, target: 15 },
  { label: "Capturas Solvers", current: 0, target: 3 },
  { label: "Drafts aprobados", current: 0, target: 5 },
];

export const weekly = [
  { day: "Lun", item: "Scout mecanismos + 5 replies", state: "done" },
  { day: "Mar", item: "Draft tools / anti-hype", state: "pending" },
  { day: "Mié", item: "Mission Control live", state: "done" },
  { day: "Jue", item: "Caso Solvers (captura)", state: "blocked · needs voice" },
  { day: "Vie", item: "Cierre / calificación take", state: "planned" },
  { day: "Dom", item: "Recap semanal", state: "planned" },
];

export const infra = {
  github: "umlazone/dash.valentin.solvers",
  vercelAccount: "umlazone-5316",
  supabaseProject: "violetaAI",
  xAccount: "@valentinflrz",
  hermesPath: "~/solvers-x-engine",
  demoUrl: "https://dashvalentinsolvers.vercel.app",
};

export const processes = [
  "P1 Daily pulse → propuestas en Mission Control",
  "P2 Captura real Solvers → draft humano",
  "P3 Scout creadores → mecanismos (no copiar texto)",
  "P4 Approve (SÍ/NO/CAMBIAR) → schedule → xurl",
  "P5 Métricas 24h/72h → ajustar áreas",
];
