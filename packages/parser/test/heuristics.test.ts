import { describe, it, expect } from 'vitest';
import {
  titleFrom,
  descriptionFrom,
  stackFrom,
  cityFrom,
  meaningfulLines,
  introFrom,
  workFrom,
  titleFromUrl,
  sphereFrom,
  looksLikeName,
} from '../src/heuristics.js';
import type { GroupedPost } from '../src/group.js';

function post(text: string): GroupedPost {
  return {
    rootMessageId: 1,
    authorName: 'Автор',
    authorId: 1,
    postedAt: '2026-06-28T10:00:00Z',
    text,
    media: [],
    messageIds: [1],
  };
}

describe('meaningfulLines', () => {
  it('выбрасывает пустые строки, голые ссылки и украшения', () => {
    expect(
      meaningfulLines('🔥🔥🔥\n\nМой сервис доставки\nhttps://example.com\n— описание'),
    ).toEqual(['Мой сервис доставки', 'описание']);
  });
});

describe('titleFrom', () => {
  it('берёт первую содержательную строку', () => {
    expect(titleFrom('CRM для стройки\nСделал на Lovable за вечер')).toBe('CRM для стройки');
  });

  it('длинную первую строку режет по границе предложения', () => {
    const long =
      'Сделал сервис подбора туров. Он берёт бюджет и даты и показывает варианты, которые реально есть в наличии у туроператоров прямо сейчас.';
    expect(titleFrom(long)).toBe('Сделал сервис подбора туров.');
  });

  it('без границы предложения обрезает по длине', () => {
    const long = `Очень длинный заголовок ${'слово '.repeat(30)}`;
    const title = titleFrom(long)!;
    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith('…')).toBe(true);
  });

  it('пост без текста заголовка не даёт', () => {
    expect(titleFrom('https://example.com')).toBeNull();
  });

  it('пропускает приветствие и обращение', () => {
    expect(titleFrom('Добрый день!\nМой первый сайт для турагентства')).toBe(
      'Мой первый сайт для турагентства',
    );
    expect(titleFrom('Коллеги,\nсделал каталог товаров')).toBe('сделал каталог товаров');
  });

  it('если кроме приветствия ничего нет — берёт его, чтобы не остаться без заголовка', () => {
    expect(titleFrom('Привет!')).toBe('Привет!');
  });
});

describe('descriptionFrom', () => {
  it('описание — строки после заголовка', () => {
    expect(descriptionFrom('CRM для стройки\nСделал на Lovable\nПодключил Supabase')).toBe(
      'Сделал на Lovable Подключил Supabase',
    );
  });

  it('однострочный пост описания не даёт', () => {
    expect(descriptionFrom('CRM для стройки')).toBeNull();
  });
});

describe('stackFrom', () => {
  it('находит названные инструменты', () => {
    expect(stackFrom('Собрал на Lovable, база в Supabase, бот в Telegram').sort()).toEqual([
      'Lovable',
      'Supabase',
      'Telegram',
    ]);
  });

  it('не ловит инструмент внутри другого слова', () => {
    expect(stackFrom('макет и маркетинг')).toEqual([]);
  });
});

describe('cityFrom', () => {
  it('находит город и страну', () => {
    expect(cityFrom('Денис, Минск, оптовая торговля')).toEqual({
      city: 'Минск',
      country: 'Беларусь',
    });
  });

  it('«Питер» приводит к каноническому имени', () => {
    expect(cityFrom('Я из Питера').city).toBe('Санкт-Петербург');
  });

  it('без города не выдумывает', () => {
    expect(cityFrom('Всем привет, занимаюсь логистикой')).toEqual({ city: null, country: null });
  });

  it('зарубежный город даёт свою страну, а не Россию', () => {
    expect(cityFrom('Я — Марина, живу в Копенгагене')).toEqual({
      city: 'Копенгаген',
      country: 'Дания',
    });
  });

  it('без города берёт страну', () => {
    expect(cityFrom('Меня зовут Вацловас. Живу в Норвегии.')).toEqual({
      city: null,
      country: 'Норвегия',
    });
  });
});

describe('sphereFrom', () => {
  it('находит сферу по роду занятий', () => {
    expect(sphereFrom('Занимаюсь логистикой и таможенным оформлением')).toBe('Логистика');
    expect(sphereFrom('Я юрист, веду корпоративное право')).toBe('Юриспруденция');
  });

  it('без узнаваемого занятия не выдумывает', () => {
    expect(sphereFrom('Просто пришёл учиться новому')).toBeNull();
  });
});

describe('introFrom', () => {
  it('кладёт текст в «о себе» и вытаскивает город', () => {
    const intro = introFrom(post('Дмитрий, Казань\nЗанимаюсь логистикой из Китая'));
    expect(intro.city).toBe('Казань');
    expect(intro.bio).toContain('логистикой');
  });
});

describe('workFrom', () => {
  it('пост со ссылкой — анонс работы', () => {
    const work = workFrom(post('CRM для стройки\nСделал на Lovable: https://crm.lovable.app'));
    expect(work.isAnnouncement).toBe(true);
    expect(work.title).toBe('CRM для стройки');
    expect(work.stack).toContain('Lovable');
  });

  it('реплика без ссылки анонсом не считается', () => {
    expect(workFrom(post('Круто получилось, поздравляю!')).isAnnouncement).toBe(false);
  });
});

describe('looksLikeName', () => {
  it('короткое название без точки — название', () => {
    expect(looksLikeName('Kavkaz Route Hub')).toBe(true);
  });

  it('фраза из чата названием не считается', () => {
    expect(looksLikeName('Уважаемые коллеги, делюсь своим первым опытом.')).toBe(false);
    expect(looksLikeName('Я создал очень крутой ассистент!')).toBe(false);
  });
});

describe('workFrom с фразой вместо названия', () => {
  it('берёт имя из адреса, а фразу оставляет в описании', () => {
    const work = workFrom(post('Я создал очень крутой ассистент!\nhttps://nihad-legal.lovable.app'));
    expect(work.title).toBe('Nihad Legal');
    expect(work.description).toContain('крутой ассистент');
  });
});

describe('хэштег ветки', () => {
  it('не попадает в текст профиля', () => {
    expect(titleFrom('#обомне Меня зовут Денис')).toBe('Меня зовут Денис');
  });
});

describe('titleFromUrl', () => {
  it('делает читаемое имя из адреса', () => {
    expect(titleFromUrl('https://kavkaz-route-hub.lovable.app/')).toBe('Kavkaz Route Hub');
    expect(titleFromUrl('https://www.hard-iron.ru')).toBe('Hard Iron');
  });

  it('технические имена превью отбрасывает', () => {
    expect(titleFromUrl('https://id-preview--d0d29c30-693f-4603.lovable.app/')).toBe('Id Preview');
  });

  it('кириллический домен оставляет адресом', () => {
    expect(titleFromUrl('https://xn--80aamepir0ark4l.xn--p1ai/')).toBe('xn--80aamepir0ark4l.xn--p1ai');
  });
});

describe('workFrom с приветствием вместо текста', () => {
  it('берёт название из адреса, а не «Добрый день!»', () => {
    const work = workFrom(post('Добрый день!\nhttps://kavkaz-route-hub.lovable.app/'));
    expect(work.title).toBe('Kavkaz Route Hub');
  });
});

describe('ссылка внутри строки', () => {
  it('не попадает в заголовок', () => {
    expect(titleFrom('https://ekaterinaallard.abacusai.app/ вот мой сайт но на абакус.')).toBe(
      'вот мой сайт но на абакус.',
    );
  });
});
