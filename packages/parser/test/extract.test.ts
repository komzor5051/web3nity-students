import { describe, it, expect } from 'vitest';
import {
  sanitizeWorkFields,
  buildWorkPrompt,
  generateWithTimeout,
  isMeaningfulIntro,
} from '../src/extract.js';

describe('sanitizeWorkFields', () => {
  it('реплика в обсуждении не становится работой', () => {
    const r = sanitizeWorkFields({ isAnnouncement: false, title: 'Здорово!' });
    expect(r.isAnnouncement).toBe(false);
  });

  it('обрезает длинный заголовок', () => {
    const r = sanitizeWorkFields({ isAnnouncement: true, title: 'a'.repeat(500) });
    expect(r.title!.length).toBeLessThanOrEqual(200);
  });

  it('приводит стек к нижнему регистру и убирает пустые', () => {
    const r = sanitizeWorkFields({
      isAnnouncement: true,
      stack: ['Claude Code', '  Next.JS  ', '', 'x'.repeat(60)],
    });
    expect(r.stack).toEqual(['claude code', 'next.js']);
  });

  it('отсутствующий isAnnouncement трактуется как «не работа»', () => {
    const r = sanitizeWorkFields({ title: 'что-то' });
    expect(r.isAnnouncement).toBe(false);
  });

  it('мусорные типы не роняют', () => {
    const r = sanitizeWorkFields({ isAnnouncement: true, title: 42, stack: 'не массив' });
    expect(r.isAnnouncement).toBe(true);
    expect(r.title).toBeUndefined();
    expect(r.stack).toEqual([]);
  });
});

describe('buildWorkPrompt', () => {
  it('передаёт в промпт уже найденные ссылки, чтобы модель их не выдумывала', () => {
    const prompt = buildWorkPrompt([
      {
        rootMessageId: 200,
        authorName: 'Dmitry',
        authorId: 555,
        postedAt: '2026-06-29T09:00:00Z',
        text: 'Мой проект https://hard-iron.ru готов',
        media: [],
        messageIds: [200],
      },
    ]);
    expect(prompt).toContain('https://hard-iron.ru');
    expect(prompt).toContain('200');
  });
});

describe('isMeaningfulIntro', () => {
  it('пустой intro — не профиль', () => {
    expect(isMeaningfulIntro({})).toBe(false);
  });

  it('intro только с именем — не профиль (одно имя не в счёт)', () => {
    expect(isMeaningfulIntro({ name: 'Денис Колесников' })).toBe(false);
  });

  it('intro с одним значимым полем — ещё не профиль', () => {
    expect(isMeaningfulIntro({ name: 'Денис', city: 'Южно-Сахалинск' })).toBe(false);
  });

  it('intro с двумя значимыми полями — уже профиль', () => {
    expect(isMeaningfulIntro({ name: 'Денис', city: 'Южно-Сахалинск', niche: 'стройматериалы' })).toBe(
      true,
    );
  });

  it('intro с полным набором полей — профиль', () => {
    expect(
      isMeaningfulIntro({
        name: 'Денис',
        age: 34,
        city: 'Южно-Сахалинск',
        country: 'Россия',
        niche: 'стройматериалы',
        bio: 'Строю склады метизов',
        goal: 'автоматизировать продажи',
        expertise: '10 лет в опте',
        hobbies: 'рыбалка',
        status: 'looking_for_clients',
      }),
    ).toBe(true);
  });

  it('пустые строки не считаются заполненными', () => {
    expect(isMeaningfulIntro({ city: '   ', country: '' })).toBe(false);
  });
});

describe('generateWithTimeout', () => {
  it('отваливается по таймауту, а не висит вечно, если модель не отвечает', async () => {
    // Промис, который никогда не резолвится, — имитирует зависший запрос,
    // из-за которого реальный прогон завис на 22 минуты без ретрая.
    const hangingModel = { generateContent: () => new Promise<never>(() => {}) };
    await expect(generateWithTimeout(hangingModel, 'prompt', 20)).rejects.toThrow(/не ответил/);
  });

  it('возвращает результат, если модель отвечает быстрее таймаута', async () => {
    const okModel = {
      generateContent: async () => ({ response: { text: () => '[]' } }) as never,
    };
    await expect(generateWithTimeout(okModel, 'prompt', 1000)).resolves.toBeTruthy();
  });
});
