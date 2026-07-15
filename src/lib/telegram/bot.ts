import {
  buildApprovalKeyboard,
  formatProposalMessage,
  type ProposalMessageInput,
} from "@/lib/telegram/approval";

type Fetcher = typeof fetch;

export type TelegramBotConfig = {
  botToken: string;
  chatId: string;
};

async function telegramApi(
  config: TelegramBotConfig,
  method: string,
  body: Record<string, unknown>,
  fetcher: Fetcher,
) {
  const response = await fetcher(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `telegram_${method}_failed`);
  }
  return payload.result || {};
}

export async function sendTextMessage(
  config: TelegramBotConfig,
  text: string,
  options: { replyMarkup?: Record<string, unknown> } = {},
  fetcher: Fetcher = fetch,
) {
  const result = await telegramApi(
    config,
    "sendMessage",
    {
      chat_id: config.chatId,
      text: text.slice(0, 3900),
      disable_web_page_preview: true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    },
    fetcher,
  );
  return { messageId: result.message_id ?? null };
}

export async function sendDraftProposal(
  config: TelegramBotConfig,
  draft: ProposalMessageInput & { id: string; version: number },
  options: { withControls?: boolean } = {},
  fetcher: Fetcher = fetch,
) {
  const result = await telegramApi(
    config,
    "sendMessage",
    {
      chat_id: config.chatId,
      text: formatProposalMessage(draft),
      ...(options.withControls === false
        ? {}
        : { reply_markup: buildApprovalKeyboard(draft.id, draft.version) }),
      disable_web_page_preview: true,
    },
    fetcher,
  );
  return { messageId: result.message_id ?? null };
}

export async function enableProposalControls(
  config: TelegramBotConfig,
  messageId: number,
  draftId: string,
  draftVersion: number,
  fetcher: Fetcher = fetch,
) {
  await telegramApi(
    config,
    "editMessageReplyMarkup",
    {
      chat_id: config.chatId,
      message_id: messageId,
      reply_markup: buildApprovalKeyboard(draftId, draftVersion),
    },
    fetcher,
  );
}

export async function answerCallback(
  config: TelegramBotConfig,
  callbackQueryId: string,
  text: string,
  fetcher: Fetcher = fetch,
) {
  await telegramApi(
    config,
    "answerCallbackQuery",
    {
      callback_query_id: callbackQueryId,
      text: text.slice(0, 180),
      show_alert: false,
    },
    fetcher,
  );
}

export async function editProposalResult(
  config: TelegramBotConfig,
  messageId: number,
  originalText: string,
  resultLine: string,
  fetcher: Fetcher = fetch,
) {
  await telegramApi(
    config,
    "editMessageText",
    {
      chat_id: config.chatId,
      message_id: messageId,
      text: `${originalText}\n\n${resultLine}`.slice(0, 3900),
      reply_markup: { inline_keyboard: [] },
      disable_web_page_preview: true,
    },
    fetcher,
  );
}
