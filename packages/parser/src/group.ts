import type { ParsedMedia, ParsedMessage } from './types.js';

export interface GroupedPost {
  /** Первый message id в группе — natural key. */
  rootMessageId: number;
  authorName: string;
  postedAt: string | null;
  /** Текст всех сообщений группы, склеенный через \n\n. */
  text: string;
  media: ParsedMedia[];
  /** id всех сообщений, попавших в группу. */
  messageIds: number[];
}

const MAX_GAP_MS = 10 * 60 * 1000; // 10 минут

/**
 * Склеивает подряд идущие сообщения одного автора (joined блоки + соседние
 * сообщения в пределах 10 минут) в один логический пост.
 *
 * Не группирует:
 * - service-сообщения,
 * - сообщения без автора (попадают как отдельные),
 * - сообщения, разорванные репликой другого автора между ними.
 */
export function groupConsecutive(messages: ParsedMessage[]): GroupedPost[] {
  const groups: GroupedPost[] = [];
  let current: GroupedPost | null = null;

  for (const m of messages) {
    if (m.isService || !m.authorName) {
      current = null;
      continue;
    }

    const sameAuthor = current && current.authorName === m.authorName;
    const closeInTime = current && withinGap(current.postedAt, m.postedAt);

    if (current && sameAuthor && (m.joined || closeInTime)) {
      // продолжаем группу
      if (m.text) current.text = current.text ? `${current.text}\n\n${m.text}` : m.text;
      if (m.media.length) current.media.push(...m.media);
      current.messageIds.push(m.messageId);
      // обновляем postedAt на последний (для следующего gap-сравнения)
      if (m.postedAt) current.postedAt = m.postedAt;
      continue;
    }

    current = {
      rootMessageId: m.messageId,
      authorName: m.authorName,
      postedAt: m.postedAt,
      text: m.text,
      media: [...m.media],
      messageIds: [m.messageId],
    };
    groups.push(current);
  }

  return groups;
}

function withinGap(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(tb - ta) <= MAX_GAP_MS;
}

/** Считается "длинным постом" — кандидатом на intro/work. */
export function isLongPost(post: GroupedPost, minChars = 80): boolean {
  return post.text.length >= minChars;
}

/** Нормализованный ключ для матчинга студента по имени из HTML-выгрузки. */
export function normalizeAuthorKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
