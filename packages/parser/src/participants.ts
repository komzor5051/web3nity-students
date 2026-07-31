/**
 * Участники чата — все, а не только те, кто написал в ветку знакомств.
 *
 * Витрина делается ради контактов, а половина людей в ветку «о себе» не
 * писала: они сразу пошли задавать вопросы и показывать работы. Их профиль
 * всё равно нужен — как минимум имя и @username.
 *
 * Рассказ о себе у таких людей обычно есть, просто лежит в другой ветке.
 * Ищем его по маркерам с весами: одно «работаю в кодексе» представлением не
 * делает, а «#обомне ... меня зовут ... живу в» — делает.
 */

import type { ParsedMessage } from './types.js';
import { groupConsecutive, type GroupedPost } from './group.js';

/**
 * Латинские двойники кириллицы. В русских чатах их печатают постоянно
 * («#oбомне» с латинской o), и поиск по подстроке на таком слове молчит.
 */
const HOMOGLYPHS: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х',
};

/** Латинские буквы внутри кириллических слов приводит к кириллице. */
export function normalizeHomoglyphs(text: string): string {
  return text.replace(/[a-zA-Z]/g, (ch, offset: number) => {
    const twin = HOMOGLYPHS[ch];
    if (!twin) return ch;
    // Меняем только там, где буква вплотную примыкает к кириллице — иначе
    // пострадают английские слова («Lovable», «Amazon»), у которых кириллица
    // стоит рядом через пробел.
    const CYRILLIC = /[Ѐ-ӿ]/;
    const touchesCyrillic = CYRILLIC.test(text[offset - 1] ?? '') || CYRILLIC.test(text[offset + 1] ?? '');
    return touchesCyrillic ? twin : ch;
  });
}

/** Признаки, которые почти наверняка означают рассказ о себе. */
const STRONG: RegExp[] = [
  /#\s*об?о\s*_?мне/i,
  /#\s*о_?себе/i,
  /меня\s+зовут/i,
  /как\s+вас\s+зовут/i,
  /чем\s+(вы\s+)?занимаетесь/i,
  /я\s+—\s+[А-ЯЁA-Z]/,
];

/** Признаки, которые сами по себе ничего не значат, но в сумме — да. */
const WEAK: RegExp[] = [
  /живу\s+в\s/i,
  /я\s+из\s/i,
  /родом\s+из/i,
  /занимаюсь\s/i,
  /по\s+образованию/i,
  /мой\s+опыт/i,
  /работаю\s+в\s+сфере/i,
  /основатель/i,
  /предприниматель/i,
  /где\s+вы\s+находитесь/i,
  /на\s+курс\s+пришл/i,
];

const STRONG_WEIGHT = 3;
/** Ниже порога — обычная реплика: одного слабого маркера мало. */
export const SELF_INTRO_THRESHOLD = 3;
/** Рассказ о себе короче этого не бывает — это реплика в обсуждении. */
const MIN_INTRO_CHARS = 120;

/** Насколько текст похож на рассказ о себе. 0 — не похож. */
export function selfIntroScore(text: string): number {
  const normalized = normalizeHomoglyphs(text);
  let score = 0;
  for (const re of STRONG) if (re.test(normalized)) score += STRONG_WEIGHT;
  for (const re of WEAK) if (re.test(normalized)) score += 1;
  return score;
}

/**
 * Лучший рассказ о себе среди постов автора: максимум по весу, при равенстве
 * — более ранний (человек представляется один раз, дальше уже обсуждение).
 */
export function bestSelfIntro(posts: GroupedPost[]): GroupedPost | null {
  let best: GroupedPost | null = null;
  let bestScore = 0;
  for (const post of posts) {
    if (post.text.length < MIN_INTRO_CHARS) continue;
    const score = selfIntroScore(post.text);
    if (score < SELF_INTRO_THRESHOLD) continue;
    if (score > bestScore) {
      best = post;
      bestScore = score;
    }
  }
  return best;
}

export interface Participant {
  authorName: string;
  authorId: number | null;
  /** Сколько сообщений человек написал в этом чате. */
  messageCount: number;
  /** Пост, похожий на рассказ о себе, если он вообще нашёлся. */
  intro: GroupedPost | null;
  /** Первое сообщение — служит source_message_id для профиля. */
  firstMessageId: number;
}

/**
 * Все авторы чата с их лучшим самопредставлением.
 *
 * Порядок сообщений сохраняем: groupConsecutive склеивает только соседние,
 * поэтому фильтровать по автору нужно после группировки, а не до.
 */
export function collectParticipants(messages: ParsedMessage[]): Participant[] {
  const posts = groupConsecutive(messages);
  const byAuthor = new Map<string, GroupedPost[]>();
  const meta = new Map<string, Participant>();

  for (const m of messages) {
    if (m.isService || !m.authorName) continue;
    const key = participantKey(m.authorName, m.authorId);
    const existing = meta.get(key);
    if (existing) {
      existing.messageCount++;
      continue;
    }
    meta.set(key, {
      authorName: m.authorName,
      authorId: m.authorId,
      messageCount: 1,
      intro: null,
      firstMessageId: m.messageId,
    });
  }

  for (const post of posts) {
    const key = participantKey(post.authorName, post.authorId);
    const list = byAuthor.get(key) ?? [];
    list.push(post);
    byAuthor.set(key, list);
  }

  for (const [key, participant] of meta) {
    participant.intro = bestSelfIntro(byAuthor.get(key) ?? []);
  }

  return [...meta.values()];
}

function participantKey(name: string, authorId: number | null): string {
  return `${name}#${authorId ?? ''}`;
}
