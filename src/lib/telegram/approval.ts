const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ApprovalAction = "approve" | "decline";

export type ProposalMessageInput = {
  title: string;
  body: string;
  language: "ES" | "EN";
  angle?: string | null;
};

const WEEKDAYS = {
  sunday: { index: 0, label: "domingo" },
  monday: { index: 1, label: "lunes" },
  tuesday: { index: 2, label: "martes" },
  wednesday: { index: 3, label: "miércoles" },
  thursday: { index: 4, label: "jueves" },
  friday: { index: 5, label: "viernes" },
  saturday: { index: 6, label: "sábado" },
} as const;

type WeekdayKey = keyof typeof WEEKDAYS;

type CalendarSlot = { time?: unknown; theme?: unknown };

export function selectNextWeeklyContentSlot(input: {
  calendar: Record<string, unknown>;
  now?: Date;
  occupied: string[];
  preferredDay?: string | null;
}) {
  if (input.calendar.timezone !== "America/Bogota") {
    throw new Error("unsupported_calendar_timezone");
  }
  const now = input.now ?? new Date();
  const offsetMinutes = -300;
  const localNowMs = now.getTime() + offsetMinutes * 60_000;
  const localNow = new Date(localNowMs);
  const preferred = String(input.preferredDay || "").toLowerCase() as WeekdayKey;
  const days = (Object.keys(WEEKDAYS) as WeekdayKey[]).filter(
    (day) => !input.preferredDay || day === preferred,
  );
  const occupied = input.occupied
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  const candidates: Array<{
    day: WeekdayKey;
    dayLabel: string;
    time: string;
    theme: string;
    scheduledFor: string;
    timestamp: number;
  }> = [];

  for (const day of days) {
    const slot = input.calendar[day] as CalendarSlot | undefined;
    const time = typeof slot?.time === "string" ? slot.time : "";
    const match = /^(\d{2}):(\d{2})$/u.exec(time);
    if (!match) continue;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) continue;
    const daysAhead = (WEEKDAYS[day].index - localNow.getUTCDay() + 7) % 7;
    let baseLocal = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + daysAhead,
      hour,
      minute,
      0,
      0,
    );
    if (baseLocal <= localNowMs) baseLocal += 7 * 24 * 60 * 60 * 1_000;

    for (let week = 0; week < 12; week += 1) {
      const timestamp = baseLocal + week * 7 * 24 * 60 * 60 * 1_000 - offsetMinutes * 60_000;
      const taken = occupied.some((value) => Math.abs(value - timestamp) < 60_000);
      if (taken) continue;
      candidates.push({
        day,
        dayLabel: WEEKDAYS[day].label,
        time,
        theme: typeof slot?.theme === "string" ? slot.theme : "",
        scheduledFor: new Date(timestamp).toISOString(),
        timestamp,
      });
      break;
    }
  }

  candidates.sort((left, right) => left.timestamp - right.timestamp);
  const selected = candidates[0];
  if (!selected) throw new Error("no_calendar_slot_available");
  return {
    day: selected.day,
    dayLabel: selected.dayLabel,
    time: selected.time,
    theme: selected.theme,
    scheduledFor: selected.scheduledFor,
  };
}

export function formatProposalMessage(input: ProposalMessageInput) {
  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 900);
  const angle = (input.angle || "").trim().slice(0, 180);
  return [
    "📝 SOLVERS · PROPUESTA HORARIA",
    "",
    `Idioma: ${input.language}`,
    angle ? `Ángulo: ${angle}` : null,
    "",
    `Título: ${title}`,
    "",
    body,
    "",
    "¿Lo montamos a X?",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function buildApprovalKeyboard(draftId: string, draftVersion: number) {
  if (!UUID_RE.test(draftId)) throw new Error("invalid_draft_id");
  if (!Number.isSafeInteger(draftVersion) || draftVersion < 1) throw new Error("invalid_draft_version");
  return {
    inline_keyboard: [
      [
        { text: "✅ Aprobar", callback_data: `mc:approve:${draftId}:${draftVersion}` },
        { text: "❌ Declinar", callback_data: `mc:decline:${draftId}:${draftVersion}` },
      ],
    ],
  };
}

export function parseApprovalCallback(data: string): {
  action: ApprovalAction;
  draftId: string;
  draftVersion: number;
} {
  const match = /^mc:(approve|decline):([0-9a-f-]{36}):(\d{1,10})$/iu.exec(String(data || "").trim());
  const draftVersion = Number(match?.[3]);
  if (
    !match ||
    !UUID_RE.test(match[2]) ||
    !Number.isSafeInteger(draftVersion) ||
    draftVersion < 1
  ) {
    throw new Error("invalid_callback");
  }
  return {
    action: match[1].toLowerCase() as ApprovalAction,
    draftId: match[2],
    draftVersion,
  };
}
