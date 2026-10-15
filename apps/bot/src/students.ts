/**
 * Привязка/создание карточки студента при входе через бота.
 * Бот служит только авторизации, поэтому здесь осталась одна операция —
 * getOrAttachStudent: найти карточку под Telegram-аккаунт или завести новую.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { COURSE_IDS, getCourse, tbl, type CourseId, type Student } from '@vibe/db';
import { normalizeAuthorKey } from '@vibe/parser';

export interface TgUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

function displayName(user: TgUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

/** Курсы человека: где его Telegram ID есть в списке участников и доступ не закрыт. */
export async function memberCourses(db: SupabaseClient, telegramUserId: number): Promise<CourseId[]> {
  const { data } = await db
    .from(tbl('members'))
    .select('course')
    .eq('telegram_user_id', telegramUserId)
    .eq('revoked', false);
  const have = new Set(((data ?? []) as { course: string }[]).map((r) => r.course));
  return COURSE_IDS.filter((c) => have.has(c));
}

/** Ученик ли это курса: Telegram ID в списке участников курса, доступ не закрыт. */
export async function isMember(db: SupabaseClient, telegramUserId: number, course: CourseId): Promise<boolean> {
  const { data } = await db
    .from(tbl('members'))
    .select('telegram_user_id')
    .eq('telegram_user_id', telegramUserId)
    .eq('course', course)
    .eq('revoked', false)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Найти / создать запись студента под пользователя бота в КУРСЕ. Вызывается
 * только для участников курса (см. memberCourses). Все шаги ограничены
 * анкетами этого курса: на двух курсах у человека две отдельные анкеты.
 * 1. По (telegram_user_id, course) — основной путь (импорт привязывает анкеты
 *    по ID автора сообщения, scripts/sync-members.ts).
 * 2. Иначе — по @username среди непривязанных анкет курса, только при
 *    единственном точном совпадении.
 * 3. Иначе — новая пустая анкета, скрытая до заполнения формы на сайте.
 *    По имени не склеиваем: тёзки и вторые аккаунты дают ложные связи.
 */
export async function getOrAttachStudent(
  db: SupabaseClient,
  user: TgUser,
  course: CourseId,
): Promise<Student> {
  const byId = await db
    .from(tbl('students'))
    .select('*')
    .eq('telegram_user_id', user.id)
    .eq('course', course)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byId.data) return byId.data as Student;

  // Telegram username регистронезависим → сравниваем lower(); ведущий '@' срезаем.
  const username = user.username?.replace(/^@/, '').toLowerCase();
  if (username) {
    const byUsername = await db
      .from(tbl('students'))
      .select('*')
      .eq('course', course)
      .is('telegram_user_id', null)
      .ilike('telegram_username', username);
    // ilike трактует '_' как wildcard, а в Telegram-username подчёркивания
    // легальны → дофильтровываем точным равенством.
    const exact = (byUsername.data as Student[] | null)?.filter(
      (s) => (s.telegram_username ?? '').replace(/^@/, '').toLowerCase() === username,
    );
    if (!byUsername.error && exact && exact.length === 1) {
      const updated = await db
        .from(tbl('students'))
        .update({ telegram_user_id: user.id, telegram_username: user.username ?? null })
        .eq('id', exact[0]!.id)
        .is('telegram_user_id', null)
        .select('*')
        .single();
      if (updated.data) return updated.data as Student;
    }
  }

  const inserted = await db
    .from(tbl('students'))
    .insert({
      telegram_user_id: user.id,
      telegram_username: user.username ?? null,
      display_name: displayName(user) || `User ${user.id}`,
      import_key: normalizeAuthorKey(displayName(user)) || null,
      cohort: getCourse(course)?.defaultCohort,
      course,
      // Анкета появится в каталоге, когда ученик заполнит форму знакомства.
      is_published: false,
    })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as Student;
}
