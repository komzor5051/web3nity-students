import type { ParsedMedia, ParsedMessage } from './types.js';

export interface GroupedPost {
  /** Первый message id в группе — natural key. */
  rootMessageId: number;
  authorName: string;
  /** Telegram user id автора, если дамп его знает. */
  authorId: number | null;
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

    // Одного имени мало: в чате бывают тёзки, и их подряд идущие сообщения
    // склеились бы в один пост. Если id известны у обоих — решают они.
    const sameAuthor =
      current !== null &&
      current.authorName === m.authorName &&
      (current.authorId === null || m.authorId === null || current.authorId === m.authorId);
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
      authorId: m.authorId,
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

/**
 * Имена, под которыми в чате пишут разные люди.
 *
 * В дампе курса такое имя есть («alex» — два разных user id). Без разведения
 * их профили и работы слились бы в один.
 */
export function ambiguousAuthorNames(messages: ParsedMessage[]): Set<string> {
  const idsByKey = new Map<string, Set<number>>();
  for (const m of messages) {
    if (!m.authorName || m.authorId === null) continue;
    const key = normalizeAuthorKey(m.authorName);
    const ids = idsByKey.get(key) ?? new Set<number>();
    ids.add(m.authorId);
    idsByKey.set(key, ids);
  }
  return new Set([...idsByKey].filter(([, ids]) => ids.size > 1).map(([key]) => key));
}

/**
 * import_key ученика. Обычно это нормализованное имя — оно же связывает
 * импортированный профиль с входом через бота. Тёзкам добавляем user id,
 * иначе они схлопнутся в один профиль.
 */
export function authorKeyOf(
  name: string,
  authorId: number | null,
  ambiguous: Set<string>,
): string {
  const key = normalizeAuthorKey(name);
  if (authorId !== null && ambiguous.has(key)) return `${key}#${authorId}`;
  return key;
}
