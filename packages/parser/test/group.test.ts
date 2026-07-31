import { describe, it, expect } from 'vitest';
import { groupConsecutive, ambiguousAuthorNames, authorKeyOf } from '../src/group.js';
import type { ParsedMessage } from '../src/types.js';

function msg(over: Partial<ParsedMessage> & { messageId: number }): ParsedMessage {
  return {
    threadId: null,
    authorName: 'Alex',
    authorId: 1,
    postedAt: '2026-06-28T10:00:00Z',
    text: 'текст',
    media: [],
    replyToId: null,
    isService: false,
    joined: false,
    ...over,
  };
}

describe('ambiguousAuthorNames', () => {
  it('находит имя, под которым пишут разные люди', () => {
    const ambiguous = ambiguousAuthorNames([
      msg({ messageId: 1, authorName: 'Alex', authorId: 1 }),
      msg({ messageId: 2, authorName: 'alex ', authorId: 2 }),
      msg({ messageId: 3, authorName: 'Дмитрий', authorId: 3 }),
    ]);
    expect(ambiguous.has('alex')).toBe(true);
    expect(ambiguous.has('дмитрий')).toBe(false);
  });

  it('одно имя и один id — не коллизия', () => {
    const ambiguous = ambiguousAuthorNames([
      msg({ messageId: 1, authorId: 1 }),
      msg({ messageId: 2, authorId: 1 }),
    ]);
    expect(ambiguous.size).toBe(0);
  });
});

describe('authorKeyOf', () => {
  const ambiguous = new Set(['alex']);

  it('тёзкам даёт разные ключи', () => {
    expect(authorKeyOf('Alex', 1, ambiguous)).toBe('alex#1');
    expect(authorKeyOf('Alex', 2, ambiguous)).toBe('alex#2');
  });

  it('обычному имени оставляет чистый ключ — по нему матчится вход через бота', () => {
    expect(authorKeyOf('Дмитрий', 3, ambiguous)).toBe('дмитрий');
  });

  it('без id разводить нечем — возвращает имя', () => {
    expect(authorKeyOf('Alex', null, ambiguous)).toBe('alex');
  });
});

describe('groupConsecutive и тёзки', () => {
  it('не склеивает подряд идущие сообщения разных людей с одним именем', () => {
    const posts = groupConsecutive([
      msg({ messageId: 1, authorId: 1, text: 'первый' }),
      msg({ messageId: 2, authorId: 2, text: 'второй' }),
    ]);
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.authorId)).toEqual([1, 2]);
  });

  it('сообщения одного человека склеивает как раньше', () => {
    const posts = groupConsecutive([
      msg({ messageId: 1, authorId: 1, text: 'первый' }),
      msg({ messageId: 2, authorId: 1, text: 'второй' }),
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.text).toBe('первый\n\nвторой');
  });
});
