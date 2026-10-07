/**
 * Подготовка текстов профиля к показу на витрине. Данные приходят из парсера
 * чатов как есть: с markdown-звёздочками, хэштегом #обомне в начале и сферами,
 * которые разные люди назвали по-разному.
 */

/** Убирает markdown-разметку и служебный хэштег из рассказа о себе. */
export function cleanBio(s: string | null): string | null {
  if (!s) return null;
  const out = s
    .replace(/\*\*|__/g, '')
    .replace(/^\s*#?обо\s?мне[\s:.,!-]*/i, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return out || null;
}

// Синонимы сфер сводим к одному чипу, иначе фильтр дробится на
// «E-commerce» и «Торговля и e-commerce» по 2 человека.
const SPHERE_ALIASES: Record<string, string> = {
  'e-commerce': 'Торговля и e-commerce',
  'производство': 'Производство и строительство',
  'строительство': 'Производство и строительство',
  'it и разработка': 'IT',
};

export function canonicalSphere(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return SPHERE_ALIASES[t.toLowerCase()] ?? (t || null);
}

/** Каждое слово запроса должно найтись в тексте — «дизайн москва» ищет оба. */
export function matchesTerms(hay: string, term: string): boolean {
  return term.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

/** Ник в Telegram без «@», пробелов и ссылки t.me — чтобы ссылка «Написать» не вела в никуда. */
export function tgHandle(s: string | null): string | null {
  if (!s) return null;
  const h = s
    .trim()
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .split(/[/?\s]/)[0];
  return h && /^[A-Za-z0-9_]{4,32}$/.test(h) ? h : null;
}

/** Первая буква имени для аватара. Эмодзи и символы в начале имени пропускаем:
 *  `name[0]` у «🔷Юрий» — половинка суррогатной пары, рисуется как «�». */
export function initialOf(name: string | null | undefined): string {
  const m = (name ?? '').match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}
