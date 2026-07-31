import { describe, it, expect } from 'vitest';
import {
  normalizeHomoglyphs,
  selfIntroScore,
  bestSelfIntro,
  collectParticipants,
} from '../src/participants.js';
import type { GroupedPost } from '../src/group.js';
import type { ParsedMessage } from '../src/types.js';

function post(text: string, rootMessageId = 1): GroupedPost {
  return {
    rootMessageId,
    authorName: 'Автор',
    authorId: 1,
    postedAt: '2026-06-28T10:00:00Z',
    text,
    media: [],
    messageIds: [rootMessageId],
  };
}

function message(over: Partial<ParsedMessage> & { messageId: number }): ParsedMessage {
  return {
    threadId: 10,
    authorName: 'Автор',
    authorId: 1,
    postedAt: '2026-06-28T10:00:00Z',
    text: '',
    media: [],
    replyToId: null,
    isService: false,
    joined: false,
    ...over,
  };
}

const INTRO_TEXT =
  '#обомне Всем привет! Меня зовут Анна. Живу в Казани, занимаюсь логистикой из Китая ' +
  'уже восемь лет. На курс пришла, чтобы собрать сайт для своей компании.';

describe('normalizeHomoglyphs', () => {
  it('чинит латинские буквы внутри русского слова', () => {
    expect(normalizeHomoglyphs('#oбoмне')).toBe('#обомне');
  });

  it('не трогает английские слова', () => {
    expect(normalizeHomoglyphs('Собрал на Lovable и Amazon')).toBe('Собрал на Lovable и Amazon');
  });
});

describe('selfIntroScore', () => {
  it('рассказ о себе набирает выше порога', () => {
    expect(selfIntroScore(INTRO_TEXT)).toBeGreaterThanOrEqual(3);
  });

  it('одного слабого маркера мало', () => {
    expect(selfIntroScore('Я работаю в сфере, где это не помогает')).toBeLessThan(3);
  });

  it('обычная реплика не набирает ничего', () => {
    expect(selfIntroScore('Подскажите, как подключить домен к Lovable?')).toBe(0);
  });

  it('хэштег с латинскими двойниками всё равно считается', () => {
    expect(selfIntroScore('#oбoмне Анжела, Великобритания, предприниматель')).toBeGreaterThanOrEqual(3);
  });
});

describe('bestSelfIntro', () => {
  it('выбирает пост с наибольшим весом', () => {
    const chosen = bestSelfIntro([post('Всем привет, я тут новенький'), post(INTRO_TEXT, 2)]);
    expect(chosen?.rootMessageId).toBe(2);
  });

  it('короткий пост представлением не считается', () => {
    expect(bestSelfIntro([post('Меня зовут Анна')])).toBeNull();
  });

  it('без подходящих постов возвращает null', () => {
    expect(bestSelfIntro([post('Спасибо, всё получилось! Сайт опубликовал, домен подключил.')])).toBeNull();
  });
});

describe('collectParticipants', () => {
  it('заводит участника на каждого автора и считает сообщения', () => {
    const people = collectParticipants([
      message({ messageId: 1, text: 'привет' }),
      message({ messageId: 2, text: 'ещё вопрос' }),
      message({ messageId: 3, authorName: 'Другой', authorId: 2, text: 'и я тут' }),
    ]);
    expect(people).toHaveLength(2);
    expect(people[0]!.messageCount).toBe(2);
    expect(people[0]!.firstMessageId).toBe(1);
  });

  it('тёзок с разными id не смешивает', () => {
    const people = collectParticipants([
      message({ messageId: 1, authorName: 'Alex', authorId: 10, text: 'раз' }),
      message({ messageId: 2, authorName: 'Alex', authorId: 20, text: 'два' }),
    ]);
    expect(people).toHaveLength(2);
  });

  it('находит рассказ о себе среди сообщений участника', () => {
    const people = collectParticipants([
      message({ messageId: 1, text: 'подскажите по домену' }),
      message({ messageId: 2, postedAt: '2026-06-29T10:00:00Z', text: INTRO_TEXT }),
    ]);
    expect(people[0]!.intro?.rootMessageId).toBe(2);
  });

  it('участник без рассказа о себе остаётся без intro', () => {
    const people = collectParticipants([message({ messageId: 1, text: 'ок, спасибо' })]);
    expect(people[0]!.intro).toBeNull();
  });
});
