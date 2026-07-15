export type NotificationMemberStatus = "pending" | "active" | "rejected";

export type NotificationMember = {
  chatId: string;
  fromId: string;
  status: NotificationMemberStatus;
  firstName?: string;
  username?: string;
  requestedAt: string;
  activatedAt?: string;
  activatedBy?: "operator_local";
};

export type NotificationCommand = "start" | "status";

const PRIVATE_CHAT_ID_RE = /^\d{5,20}$/u;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/[\u0000-\u001f\u007f]/gu, " ")
        .replace(/\s+/gu, " ")
        .slice(0, maxLength)
    : "";
}

function validIsoDate(value: string) {
  return Boolean(value) && Number.isFinite(new Date(value).getTime());
}

export function parseNotificationCommand(text: string): NotificationCommand | null {
  const match = /^\/(start|status)(?:@[A-Za-z0-9_]+)?(?:\s.*)?$/iu.exec(String(text || "").trim());
  return match ? (match[1].toLowerCase() as NotificationCommand) : null;
}

export function isPrivateTelegramIdentity(input: {
  chatId: string;
  chatType?: string;
  fromId: string;
}) {
  return (
    input.chatType === "private" &&
    PRIVATE_CHAT_ID_RE.test(input.chatId) &&
    input.chatId === input.fromId
  );
}

export function isValidOperatorCallbackIdentity(input: {
  operatorChatId: string;
  messageChatId: string;
  messageChatType?: string;
  callbackFromId: string;
}) {
  return (
    input.messageChatType === "private" &&
    PRIVATE_CHAT_ID_RE.test(input.operatorChatId) &&
    input.messageChatId === input.operatorChatId &&
    input.callbackFromId === input.operatorChatId
  );
}

export function notificationMemberKey(chatId: string) {
  if (!PRIVATE_CHAT_ID_RE.test(chatId)) throw new Error("invalid_team_chat_id");
  return `telegram_notification_member:${chatId}`;
}

export function normalizeNotificationMember(value: unknown): NotificationMember | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const chatId = cleanText(item.chatId, 20);
  const fromId = cleanText(item.fromId, 20);
  const status = cleanText(item.status, 20) as NotificationMemberStatus;
  const requestedAt = cleanText(item.requestedAt, 40);
  if (
    !PRIVATE_CHAT_ID_RE.test(chatId) ||
    fromId !== chatId ||
    !["pending", "active", "rejected"].includes(status) ||
    !validIsoDate(requestedAt)
  ) {
    return null;
  }
  const firstName = cleanText(item.firstName, 80);
  const username = cleanText(item.username, 80).replace(/^@/u, "");
  const activatedAt = cleanText(item.activatedAt, 40);
  const activatedBy = cleanText(item.activatedBy, 40);
  if (status === "active" && (!validIsoDate(activatedAt) || activatedBy !== "operator_local")) {
    return null;
  }
  return {
    chatId,
    fromId,
    status,
    requestedAt,
    ...(firstName ? { firstName } : {}),
    ...(username ? { username } : {}),
    ...(validIsoDate(activatedAt) ? { activatedAt } : {}),
    ...(activatedBy === "operator_local" ? { activatedBy: "operator_local" as const } : {}),
  };
}

export function buildPendingNotificationMember(input: {
  chatId: string;
  fromId: string;
  firstName?: string;
  username?: string;
  now: string;
}): NotificationMember {
  if (!isPrivateTelegramIdentity({ chatId: input.chatId, chatType: "private", fromId: input.fromId })) {
    throw new Error("private_team_chat_required");
  }
  if (!validIsoDate(input.now)) throw new Error("invalid_team_request_time");
  const firstName = cleanText(input.firstName, 80);
  const username = cleanText(input.username, 80).replace(/^@/u, "");
  return {
    chatId: input.chatId,
    fromId: input.fromId,
    status: "pending",
    requestedAt: input.now,
    ...(firstName ? { firstName } : {}),
    ...(username ? { username } : {}),
  };
}

export function activateNotificationMember(
  current: NotificationMember,
  input: { now: string; activatedBy: "operator_local" },
): NotificationMember {
  if (current.status !== "pending") throw new Error("team_member_not_pending");
  if (!validIsoDate(input.now)) throw new Error("invalid_team_activation_time");
  return {
    ...current,
    status: "active",
    activatedAt: input.now,
    activatedBy: input.activatedBy,
  };
}

export function isActiveNotificationMember(value: unknown, chatId: string) {
  const member = normalizeNotificationMember(value);
  return Boolean(member && member.chatId === chatId && member.status === "active");
}

export function activeNotificationChatIds(
  rows: Array<{ value: unknown }>,
  operatorChatId: string,
) {
  const ids = new Set<string>();
  for (const row of rows) {
    const member = normalizeNotificationMember(row.value);
    if (member?.status === "active" && member.chatId !== operatorChatId) {
      ids.add(member.chatId);
    }
  }
  ids.add(operatorChatId);
  return [...ids];
}

export type TelegramApprovalMessage = {
  chatId: string;
  messageId: number;
};

export function normalizeTelegramApprovalMessages(metadata: unknown): TelegramApprovalMessage[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).telegram_approval_messages;
  if (!Array.isArray(raw)) return [];
  const messages = new Map<string, TelegramApprovalMessage>();
  for (const value of raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>;
    const chatId = cleanText(item.chat_id, 20);
    const messageId = Number(item.message_id);
    if (!PRIVATE_CHAT_ID_RE.test(chatId) || !Number.isSafeInteger(messageId) || messageId <= 0) continue;
    messages.set(chatId, { chatId, messageId });
  }
  return [...messages.values()];
}

export function formatTelegramDecisionLine(input: {
  decision: "approve" | "decline";
  scheduledFor?: string | null;
  actor?: unknown;
}) {
  const rawActor = cleanText(input.actor, 120);
  const actor = rawActor === "telegram_operator"
    ? "Valentin"
    : rawActor.startsWith("telegram_team:")
      ? rawActor.slice("telegram_team:".length) || "equipo"
      : "equipo";
  if (input.decision === "decline") {
    return `❌ DENEGADO · no se publica · por ${actor}`;
  }
  const schedule = input.scheduledFor
    ? new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(input.scheduledFor))
    : "la próxima franja disponible";
  return `✅ APROBADO · ${schedule} · por ${actor}`;
}

export function formatTeamAccessRequest(input: {
  chatId: string;
  firstName?: string;
  username?: string;
}) {
  const name = cleanText(input.firstName, 80) || "Miembro sin nombre";
  const username = cleanText(input.username, 80).replace(/^@/u, "");
  return [
    "👤 SOLVERS · SOLICITUD DE ACCESO",
    "",
    `Nombre: ${name}`,
    username ? `Usuario: @${username}` : null,
    `Chat: ${input.chatId}`,
    "",
    "Acceso solicitado: mismas propuestas y controles compartidos de Aprobar/Denegar.",
    "La activación se hace manualmente. La primera decisión válida queda definitiva para ambos chats.",
    "No incluye OTP ni acceso al panel.",
  ].filter(Boolean).join("\n");
}

export function startOfBogotaDay(now: Date) {
  const offsetMs = 5 * 60 * 60 * 1_000;
  const bogotaClock = new Date(now.getTime() - offsetMs);
  return new Date(Date.UTC(
    bogotaClock.getUTCFullYear(),
    bogotaClock.getUTCMonth(),
    bogotaClock.getUTCDate(),
    5,
    0,
    0,
    0,
  ));
}

export function formatTeamStatus(input: {
  publisherLive: boolean;
  draftsInReview: number;
  publicationsQueued: number;
  publicationsFailed: number;
  publishedToday: number;
  nextScheduledFor: string | null;
}) {
  const next = input.nextScheduledFor
    ? new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(input.nextScheduledFor))
    : "sin publicaciones programadas";
  return [
    "📊 SOLVERS · ESTADO",
    "",
    `Publicador: ${input.publisherLive ? "activo" : "pausado"}`,
    `En revisión: ${input.draftsInReview}`,
    `En cola: ${input.publicationsQueued}`,
    `Publicados hoy: ${input.publishedToday}`,
    `Fallidos: ${input.publicationsFailed}`,
    `Próximo: ${next}`,
    "",
    "Decisiones compartidas · La primera aprobación o denegación válida queda definitiva para ambos chats.",
  ].join("\n");
}
