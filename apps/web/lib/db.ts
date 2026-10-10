// Все чтения данных учеников идут через service-клиент на сервере после
// проверки сессии (lib/auth.ts). Анонимного клиента больше нет: платформа
// закрыта для посторонних, анонимные политики чтения в базе сняты.

/**
 * Префикс таблиц. Пусто = выделенный Supabase-проект.
 * `vibe_` = временное размещение в общем проекте lvmn-hub.
 * Должен совпадать с SUPABASE_TABLE_PREFIX в backend (.env).
 */
export const TABLE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_TABLE_PREFIX ?? '';
export function tbl(name: string): string {
  return TABLE_PREFIX + name;
}

export type StudentStatus = 'looking_for_clients' | 'looking_for_partners' | 'just_learning';

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
  status: StudentStatus | null;
  /** Несколько статусов из формы; status — первый из них, для старого кода. */
  statuses: StudentStatus[];
  /** Регион, выбранный учеником. null — вычисляется из города/страны. */
  region: string | null;
  /** «Для чего пришли на практикум и чего ожидаете». */
  expectations: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  source_message_id: string | null;
  cohort: string;
  import_key: string | null;
  is_published: boolean;
  /** Проставляется, когда человек сам отредактировал профиль через сайт. */
  self_edited_at: string | null;
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
  live_url: string | null;
  repo_url: string | null;
  screenshot_path: string | null;
  screenshot_failed: boolean;
  stack: string[];
  /** Тип инструмента: выбирает автор из общего справочника. */
  kind: WorkKind | null;
  stage: WorkStage | null;
  features: string | null;
  feedback_request: string | null;
  /** Скрыт организатором — не показывается никому, кроме автора. */
  hidden_by_admin: boolean;
};

export type WorkKind = 'site' | 'bot' | 'crm' | 'other';
export type WorkStage = 'in_progress' | 'done';

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

/**
 * Публичный slug ученика. С telegram_username всегда уникален (Telegram сам
 * это гарантирует). Без него — транслит имени НЕ уникален: два Ивана Петрова
 * или один ученик на двух тарифах дадут коллизию, и второй профиль станет
 * недоступен (совпадение отдаётся первому найденному). Поэтому всегда
 * добавляем короткий суффикс из id — он уникален по построению.
 */
export function studentSlug(s: Pick<StudentRow, 'telegram_username' | 'display_name' | 'id'>): string {
  if (s.telegram_username) return s.telegram_username.toLowerCase();
  const tr = transliterate(s.display_name);
  const suffix = s.id.replace(/-/g, '').slice(0, 6);
  return tr ? `${tr}-${suffix}` : suffix;
}
