const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ApprovalAction = "approve" | "decline";

export type ProposalMessageInput = {
  title: string;
  body: string;
  language: "ES" | "EN";
  angle?: string | null;
};

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

export function buildApprovalKeyboard(draftId: string) {
  if (!UUID_RE.test(draftId)) throw new Error("invalid_draft_id");
  return {
    inline_keyboard: [
      [
        { text: "✅ Aprobar", callback_data: `mc:approve:${draftId}` },
        { text: "❌ Declinar", callback_data: `mc:decline:${draftId}` },
      ],
    ],
  };
}

export function parseApprovalCallback(data: string): {
  action: ApprovalAction;
  draftId: string;
} {
  const match = /^mc:(approve|decline):([0-9a-f-]{36})$/iu.exec(String(data || "").trim());
  if (!match || !UUID_RE.test(match[2])) throw new Error("invalid_callback");
  return {
    action: match[1].toLowerCase() as ApprovalAction,
    draftId: match[2],
  };
}
