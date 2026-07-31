/**
 * Соответствие «чат + ветка форума → тип содержимого».
 *
 * В Web3nity тип поста определял LLM по тексту. Здесь чат — форум с
 * именованными ветками, и ветка говорит тип точнее и бесплатно.
 * Соответствие задаётся явно: эвристика по названию ветки сломается
 * при первом переименовании.
 */

export type TopicKind = 'intro' | 'work' | 'qa' | 'chat' | 'ignore' | 'vip_personal';

export interface ChatConfig {
  chatId: number;
  cohort: string;
  /** Явное соответствие topic_id → тип. */
  topics: Record<number, TopicKind>;
  /** Тип для веток, которых нет в topics, и для сообщений вне веток. */
  defaultKind: TopicKind;
}

export const CHAT_CONFIGS: ChatConfig[] = [
  {
    chatId: -1004353204500,
    cohort: 'vibecoding-main',
    topics: {
      11: 'work',
      10: 'intro',
      6: 'chat',
      14: 'qa',
      15: 'qa',
      16: 'qa',
      17: 'qa',
      2: 'ignore',
      // Служебная ветка General — называется именем чата, содержимого не несёт.
      1: 'ignore',
    },
    defaultKind: 'chat',
  },
  {
    chatId: -1004413372752,
    cohort: 'vibecoding-2month',
    topics: {
      20: 'work',
      4: 'qa',
      5: 'qa',
      6: 'qa',
      7: 'qa',
      8: 'qa',
      2: 'ignore',
      1: 'ignore',
    },
    defaultKind: 'chat',
  },
  {
    // VIP: общих тематических веток нет, каждая ветка — отдельный ученик.
    // Название ветки становится import_key, содержимое не публикуется.
    chatId: -1003966609206,
    cohort: 'vibecoding-vip',
    topics: {
      2: 'ignore',
      // Без этого General-ветка стала бы «учеником» по имени чата.
      1: 'ignore',
    },
    defaultKind: 'vip_personal',
  },
];

const BY_ID = new Map(CHAT_CONFIGS.map((c) => [c.chatId, c]));

function configOf(chatId: number): ChatConfig {
  const config = BY_ID.get(chatId);
  if (!config) {
    throw new Error(
      `неизвестный чат ${chatId} — добавьте его в CHAT_CONFIGS или уберите из дампа`,
    );
  }
  return config;
}

export function classifyByTopic(chatId: number, topicId: number | null): TopicKind {
  const config = configOf(chatId);
  // Сообщение вне веток — это болтовня в корне форума, не работа.
  if (topicId === null) return config.chatId === -1003966609206 ? 'chat' : config.defaultKind;
  return config.topics[topicId] ?? config.defaultKind;
}

export function cohortOf(chatId: number): string {
  return configOf(chatId).cohort;
}
