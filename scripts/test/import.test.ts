import { describe, it, expect } from 'vitest';
import {
  buildStudentPayload,
  buildWorkPayload,
  mergeStudentFields,
  normalizeLiveUrl,
  dedupeWorksByLiveUrl,
  resolveTopicOwnerId,
  type WorkPayload,
} from '../import.js';
import type { ParsedMessage } from '@vibe/parser';

function vipMsg(messageId: number, authorName: string, authorId: number | null): ParsedMessage {
  return {
    messageId,
    threadId: 45,
    authorName,
    authorId,
    postedAt: '2026-06-28T10:00:00Z',
    text: 'сообщение в ветке',
    media: [],
    replyToId: null,
    isService: false,
    joined: false,
  };
}

describe('resolveTopicOwnerId', () => {
  it('владелец ветки — тот, кто пишет в ней под именем ветки, а не куратор', () => {
    const owner = resolveTopicOwnerId(
      [
        vipMsg(1, 'Влад Лямин', 900),
        vipMsg(2, 'Алекс', 42),
        vipMsg(3, 'Влад Лямин', 900),
        vipMsg(4, 'Алекс', 42),
      ],
      'Алекс',
    );
    expect(owner).toBe(42);
  });

  it('из двух тёзок в ветке выбирает того, кто в ней активнее', () => {
    const owner = resolveTopicOwnerId(
      [vipMsg(1, 'Алекс', 42), vipMsg(2, 'алекс', 77), vipMsg(3, 'Алекс', 42)],
      'Алекс',
    );
    expect(owner).toBe(42);
  });

  it('под именем ветки никто не писал — владельца нет', () => {
    expect(resolveTopicOwnerId([vipMsg(1, 'Влад Лямин', 900)], 'Алекс')).toBeNull();
  });
});

/** Минимальный валидный WorkPayload для тестов дедупликации — поля, не участвующие в сравнении, произвольные. */
function work(overrides: Partial<WorkPayload> & { cohort: string; import_key: string }): WorkPayload {
  return {
    title: 'Проект',
    description: null,
    live_url: null,
    repo_url: null,
    stack: [],
    tags: [],
    source_message_id: 'tg:-1:1',
    posted_at: null,
    is_published: true,
    ...overrides,
  };
}

describe('buildStudentPayload', () => {
  it('берёт имя из LLM, а при отсутствии — имя автора из Telegram', () => {
    const a = buildStudentPayload({
      chatId: -1004353204500,
      authorName: 'Денис Колесников',
      authorUsername: 'KolesnikovGroup',
      rootMessageId: 100,
      intro: { name: 'Денис Колесников', city: 'Южно-Сахалинск' },
    });
    expect(a.display_name).toBe('Денис Колесников');
    expect(a.city).toBe('Южно-Сахалинск');

    const b = buildStudentPayload({
      chatId: -1004353204500,
      authorName: 'IV',
      authorUsername: 'IVM2030',
      rootMessageId: 101,
      intro: {},
    });
    expect(b.display_name).toBe('IV');
  });

  it('когорта соответствует чату', () => {
    const vip = buildStudentPayload({
      chatId: -1003966609206,
      authorName: 'Алекс',
      authorUsername: null,
      rootMessageId: 45,
      intro: {},
    });
    expect(vip.cohort).toBe('vibecoding-vip');
  });

  it('import_key нормализован', () => {
    const p = buildStudentPayload({
      chatId: -1004353204500,
      authorName: '  Денис   Колесников ',
      authorUsername: null,
      rootMessageId: 100,
      intro: {},
    });
    expect(p.import_key).toBe('денис колесников');
  });

  it('source_message_id в формате tg:<chat>:<msg> — совпадает с форматом бота', () => {
    const p = buildStudentPayload({
      chatId: -1004353204500,
      authorName: 'X',
      authorUsername: null,
      rootMessageId: 100,
      intro: {},
    });
    expect(p.source_message_id).toBe('tg:-1004353204500:100');
  });
});

describe('buildWorkPayload', () => {
  const base = {
    chatId: -1004353204500,
    importKey: 'dmitry',
    rootMessageId: 200,
    postedAt: '2026-06-29T09:00:00Z',
    text: 'Мой проект https://hard-iron.ru и код https://github.com/a/b',
  };

  it('реплика в обсуждении не даёт работы', () => {
    expect(buildWorkPayload({ ...base, work: { isAnnouncement: false } })).toBeNull();
  });

  it('анонс со ссылками заполняет live_url и repo_url', () => {
    const w = buildWorkPayload({
      ...base,
      work: { isAnnouncement: true, title: 'Каталог метизов', stack: ['claude code'] },
    })!;
    expect(w.live_url).toBe('https://hard-iron.ru');
    expect(w.repo_url).toBe('https://github.com/a/b');
    expect(w.stack).toEqual(['claude code']);
  });

  it('анонс без ссылки — валидная работа', () => {
    const w = buildWorkPayload({
      ...base,
      text: 'Собрал систему учёта на умных таблицах, делюсь опытом',
      work: { isAnnouncement: true, title: 'Учёт на умных таблицах' },
    })!;
    expect(w.title).toBe('Учёт на умных таблицах');
    expect(w.live_url).toBeNull();
  });

  it('анонс без заголовка отбрасывается — на витрине нечего показать', () => {
    expect(buildWorkPayload({ ...base, work: { isAnnouncement: true } })).toBeNull();
  });

  it('работа из публичной ветки показа публикуется', () => {
    const w = buildWorkPayload({
      ...base,
      source: 'showcase',
      work: { isAnnouncement: true, title: 'Сайт' },
    })!;
    expect(w.is_published).toBe(true);
  });

  it('работа из личной ветки VIP остаётся черновиком', () => {
    const w = buildWorkPayload({
      ...base,
      chatId: -1003966609206,
      source: 'vip_personal',
      work: { isAnnouncement: true, title: 'Внутренний дашборд' },
    })!;
    expect(w.is_published).toBe(false);
  });
});

describe('mergeStudentFields', () => {
  const payload = {
    display_name: 'Денис Колесников',
    city: 'Южно-Сахалинск',
    niche: 'стройматериалы',
    bio: 'из импорта',
  };
  const postedAt = '2026-06-28T10:00:00Z';

  it('заполняет поля, если ученик профиль не трогал', () => {
    const existing = { updated_at: '2026-06-28T10:00:30Z', bio: null };
    const merged = mergeStudentFields(payload, existing, postedAt);
    expect(merged.bio).toBe('из импорта');
    expect(merged.city).toBe('Южно-Сахалинск');
  });

  it('не перетирает профиль, отредактированный вручную позже поста', () => {
    const existing = { updated_at: '2026-07-15T12:00:00Z', bio: 'написал сам' };
    const merged = mergeStudentFields(payload, existing, postedAt);
    expect(merged).toEqual({});
  });

  it('порог ровно 60 секунд не считается ручной правкой', () => {
    const existing = { updated_at: '2026-06-28T10:01:00Z', bio: null };
    const merged = mergeStudentFields(payload, existing, postedAt);
    expect(merged.bio).toBe('из импорта');
  });

  it('нового ученика заполняет целиком', () => {
    const merged = mergeStudentFields(payload, null, postedAt);
    expect(merged.display_name).toBe('Денис Колесников');
  });

  it('не затирает заполненное поле пустым значением из импорта', () => {
    const existing = { updated_at: '2026-06-28T10:00:10Z', bio: 'уже было' };
    const merged = mergeStudentFields({ ...payload, bio: null }, existing, postedAt);
    expect(merged.bio).toBeUndefined();
  });
});

describe('normalizeLiveUrl', () => {
  it('убирает схему, www и завершающий слэш, хост в нижний регистр', () => {
    expect(normalizeLiveUrl('https://WWW.Example.com/')).toBe('example.com');
    expect(normalizeLiveUrl('http://example.com')).toBe('example.com');
  });

  it('путь и query остаются значимыми', () => {
    expect(normalizeLiveUrl('https://kavkaz-route-hub.lovable.app/crm/requests')).toBe(
      'kavkaz-route-hub.lovable.app/crm/requests',
    );
    expect(normalizeLiveUrl('https://kavkaz-route-hub.lovable.app/')).toBe('kavkaz-route-hub.lovable.app');
  });
});

describe('dedupeWorksByLiveUrl', () => {
  it('точное совпадение live_url у одного автора схлопывается — остаётся более поздняя', () => {
    const older = work({
      cohort: 'vibecoding-main',
      import_key: 'nihad',
      live_url: 'https://accessible-for-all-solutions.lovable.app',
      posted_at: '2026-06-20T10:00:00Z',
      title: 'Первая версия',
    });
    const newer = work({
      cohort: 'vibecoding-main',
      import_key: 'nihad',
      live_url: 'https://accessible-for-all-solutions.lovable.app/',
      posted_at: '2026-06-25T10:00:00Z',
      title: 'Доработка',
    });
    const result = dedupeWorksByLiveUrl([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Доработка');
  });

  it('разные пути на одном хосте — разные работы, не схлопываются', () => {
    const site = work({
      cohort: 'vibecoding-main',
      import_key: 'dmitry',
      live_url: 'https://kavkaz-route-hub.lovable.app/',
      title: 'Сайт',
    });
    const crm = work({
      cohort: 'vibecoding-main',
      import_key: 'dmitry',
      live_url: 'https://kavkaz-route-hub.lovable.app/crm/requests',
      title: 'CRM',
    });
    expect(dedupeWorksByLiveUrl([site, crm])).toHaveLength(2);
  });

  it('разные поддомены одной платформы — разные работы, не схлопываются', () => {
    const a = work({
      cohort: 'vibecoding-main',
      import_key: 'nihad',
      live_url: 'https://nihad-legal.lovable.app',
      title: 'AI-ассистент для юридической сферы',
    });
    const b = work({
      cohort: 'vibecoding-main',
      import_key: 'nihad',
      live_url: 'https://nihad-legaldesk.lovable.app',
      title: 'Второй проект',
    });
    expect(dedupeWorksByLiveUrl([a, b])).toHaveLength(2);
  });

  it('работы без ссылки не трогает', () => {
    const a = work({ cohort: 'vibecoding-main', import_key: 'x', live_url: null, title: 'Таблица' });
    const b = work({ cohort: 'vibecoding-main', import_key: 'x', live_url: null, title: 'Другая таблица' });
    expect(dedupeWorksByLiveUrl([a, b])).toHaveLength(2);
  });

  it('один и тот же адрес у разных авторов не схлопывается', () => {
    const a = work({
      cohort: 'vibecoding-main',
      import_key: 'author-a',
      live_url: 'https://shared-template.lovable.app',
    });
    const b = work({
      cohort: 'vibecoding-main',
      import_key: 'author-b',
      live_url: 'https://shared-template.lovable.app',
    });
    expect(dedupeWorksByLiveUrl([a, b])).toHaveLength(2);
  });
});
