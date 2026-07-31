/**
 * Чтение JSON-дампа Telegram (scripts/dump_telegram.py) в ParsedMessage.
 *
 * Заменяет html.ts: источник теперь живой Telegram, а не одноразовая
 * HTML-выгрузка. Главное приобретение — threadId, который в HTML всегда
 * был null. По нему работает классификация в topics.ts.
 */

import { readFile } from 'node:fs/promises';
import type { ParsedMessage } from './types.js';

export interface DumpMessage {
  message_id: number;
  topic_id: number | null;
  author_id: number | null;
  author_name: string | null;
  author_username: string | null;
  posted_at: string | null;
  text: string;
  has_media: boolean;
  reply_to_id: number | null;
}

export interface ChatDump {
  chatId: number;
  title: string;
  /** topic_id (строкой) → название ветки. Для VIP это имя ученика. */
  topics: Record<string, string>;
  messages: DumpMessage[];
}

interface RawDump {
  chats: {
    chat_id: number;
    title: string;
    topics: Record<string, string>;
    messages: DumpMessage[];
  }[];
}

export async function readDump(filePath: string): Promise<ChatDump[]> {
  const raw = JSON.parse(await readFile(filePath, 'utf-8')) as RawDump;
  if (!Array.isArray(raw.chats)) {
    throw new Error(`${filePath}: ожидался объект с полем chats`);
  }
  return raw.chats.map((c) => ({
    chatId: c.chat_id,
    title: c.title,
    topics: c.topics ?? {},
    messages: c.messages ?? [],
  }));
}

export function toParsedMessages(chat: ChatDump): ParsedMessage[] {
  return chat.messages.map((m) => ({
    messageId: m.message_id,
    threadId: m.topic_id,
    authorName: m.author_name,
    authorId: m.author_id ?? null,
    postedAt: m.posted_at,
    text: m.text ?? '',
    // Медиа из Telegram не выкачиваем: работы показываются скриншотами
    // живых сайтов, а не картинками из чата.
    media: [],
    replyToId: m.reply_to_id,
    isService: false,
    joined: false,
  }));
}

export function topicTitle(chat: ChatDump, topicId: number): string | null {
  return chat.topics[String(topicId)] ?? null;
}

/** Имя автора → его telegram_username. Нужно, чтобы заполнить контакт в профиле. */
export function usernameByAuthorName(chat: ChatDump): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of chat.messages) {
    if (m.author_name && m.author_username && !out.has(m.author_name)) {
      out.set(m.author_name, m.author_username);
    }
  }
  return out;
}
