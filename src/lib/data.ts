export type DraftStatus = "pending" | "approved" | "posted" | "rejected";

export type ContentArea = {
  id: string;
  code: string;
  name: string;
  description: string;
  priority: "core" | "growth" | "side";
  weeklyTarget: string;
};

export type Draft = {
  id: string;
  title: string;
  area: string;
  status: DraftStatus;
  language: "ES" | "EN" | "MIX";
  preview: string;
  source: string;
  updatedAt: string;
};

export type Metric = {
  label: string;
  value: string;
  hint?: string;
};

export const account = {
  handle: "@valentinflrz",
  name: "Valentin Florez",
  bio: "Agentic operations studio. Agents do the work. We build the systems.",
  followers: 321,
  following: 188,
  plan: "Premium",
  objective90d: "Mix — marca personal + leads Solvers alto ticket",
  language: "ES default · EN selectivo",
  phase: "Mission Control + calibración de voz",
};

export const statusCards: Metric[] = [
  { label: "Followers", value: "321", hint: "early stage" },
  { label: "Posts core / sem", value: "0/5", hint: "meta calibración" },
  { label: "Drafts pending", value: "1", hint: "listos para approve" },
  { label: "Auto-post", value: "OFF", hint: "solo con approve" },
];

export const areas: ContentArea[] = [
  {
    id: "a1",
    code: "A1",
    name: "Solvers en la calle",
    description: "Builds, clientes, sistemas, metas del studio.",
    priority: "core",
    weeklyTarget: "2–3",
  },
  {
    id: "a2",
    code: "A2",
    name: "Roadblocks & no-aciertos",
    description: "Fricciones reales y cómo se destrabaron.",
    priority: "core",
    weeklyTarget: "1–2",
  },
  {
    id: "a3",
    code: "A3",
    name: "Middleware aburrido que paga",
    description: "Integraciones, ROI, procesos feos con resultado.",
    priority: "core",
    weeklyTarget: "1–2",
  },
  {
    id: "a4",
    code: "A4",
    name: "Cierre alto ticket",
    description: "Discovery, objeciones, quién sí/no es cliente.",
    priority: "core",
    weeklyTarget: "1",
  },
  {
    id: "a5",
    code: "A5",
    name: "Tools con criterio",
    description: "Sirvió / no sirvió. Sin review de YouTuber.",
    priority: "growth",
    weeklyTarget: "1",
  },
  {
    id: "a6",
    code: "A6",
    name: "Anti-hype con base",
    description: "Cortar humo del mercado con experiencia real.",
    priority: "growth",
    weeklyTarget: "1",
  },
  {
    id: "a7",
    code: "A7",
    name: "Preguntas que abren red",
    description: "Preguntas de operador, no bait vacío.",
    priority: "growth",
    weeklyTarget: "2",
  },
  {
    id: "a9",
    code: "A9",
    name: "Reply / Quote radar",
    description: "Distribución: replies de valor en el nicho.",
    priority: "growth",
    weeklyTarget: "10–15",
  },
];

export const drafts: Draft[] = [
  {
    id: "d1",
    title: "La tool que me quemó la cuenta en un prompt",
    area: "A5/A6",
    status: "pending",
    language: "ES",
    preview:
      "Una tool me quemó la cuenta con un solo prompt. La única vez que “sirvió” fue porque ruteó a un modelo top. No es magia: es routing, cuotas y plata escondida.",
    source: "Reply real a @freddier",
    updatedAt: "2026-07-09",
  },
];

export const weekly = [
  { day: "Jue", item: "Tool que quemó la cuenta", state: "pending" },
  { day: "Vie", item: "Claude one-shot sitio Solvers", state: "needs details" },
  { day: "Sáb", item: "Pregunta: WhatsApp + Excel", state: "draftable" },
  { day: "Dom", item: "Middleware aburrido", state: "blocked on proof" },
  { day: "Lun", item: "Hermes vs OpenClaw roadblock", state: "needs voice" },
  { day: "Mar", item: "Reply day intensivo", state: "ongoing" },
  { day: "Mié", item: "Qué hace un agentic ops studio", state: "needs voice" },
];

export const processes = [
  "Daily pulse: posts, likes, timeline, mentions → 1–3 propuestas",
  "Captura Valentin → caso/roadblock/close/tool → draft",
  "Scout creadores → solo mecanismos → remix Solvers",
  "Publish solo desde approved + log métricas",
  "Weekly review: qué sonó a robot vs qué pegó",
];

export const infra = {
  github: "umlazone/dash.valentin.solvers",
  vercelAccount: "umlazone-5316",
  supabaseProject: "violetaAI",
  xAccount: "@valentinflrz",
  hermesPath: "~/solvers-x-engine",
};
