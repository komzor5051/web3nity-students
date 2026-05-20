import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!url || !anon) {
  // На этапе билда переменных может ещё не быть. Кидаем явную ошибку при первом обращении.
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing — public reads will fail.');
}

export const supabase = createClient(url ?? 'http://localhost', anon ?? 'anon', {
  auth: { persistSession: false },
});

/**
 * Префикс таблиц. Пусто = выделенный Supabase-проект.
 * `web3nity_` = временное размещение в общем проекте lvmn-hub.
 * Должен совпадать с SUPABASE_TABLE_PREFIX в backend (.env).
 */
export const TABLE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_TABLE_PREFIX ?? '';
export function tbl(name: string): string {
  return TABLE_PREFIX + name;
}

export type StudentRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  niche: string | null;
  sphere: string | null;
  bio: string | null;
  goal: string | null;
  expertise: string | null;
  hobbies: string | null;
  age: number | null;
  status: 'looking_for_clients' | 'looking_for_partners' | 'just_learning' | null;
  telegram_username: string | null;
  cohort: string;
  import_key: string | null;
  is_published: boolean;
  updated_at: string;
};

export type WorkRow = {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  media: { type: string; url: string; caption?: string }[];
  tags: string[];
  posted_at: string | null;
  is_published: boolean;
  updated_at: string;
};

/** Транслит для slug, если у студента нет telegram_username. */
export function transliterate(s: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
    з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return s
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function studentSlug(s: Pick<StudentRow, 'telegram_username' | 'display_name' | 'id'>): string {
  if (s.telegram_username) return s.telegram_username.toLowerCase();
  const tr = transliterate(s.display_name);
  return tr || s.id.slice(0, 8);
}
