/**
 * Привязка/создание карточки студента при входе через бота.
 * Бот служит только авторизации, поэтому здесь осталась одна операция —
 * getOrAttachStudent: найти карточку под Telegram-аккаунт или завести новую.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { tbl, type Student } from '@web3nity/db';
import { normalizeAuthorKey } from '@web3nity/parser';

const COHORT = process.env.COHORT ?? 'AI-Ассистенты 3.0';

export interface TgUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

function displayName(user: TgUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

/**
 * Найти / создать запись студента под пользователя бота.
 * 1. По telegram_user_id — основной путь.
 * 2. Иначе — по telegram_username (cohort, непривязанные) — матчим
 *    импортированный профиль по @username без учёта регистра, только при
 *    единственном совпадении.
 * 3. Иначе — по (cohort, import_key) — матчим импортированный профиль по имени.
 * 4. Иначе — создаём нового, is_published=false (публикация — на сайте).
 */
export async function getOrAttachStudent(
  db: SupabaseClient,
  user: TgUser,
): Promise<Student> {
  const byId = await db
    .from(tbl('students'))
    .select('*')
    .eq('telegram_user_id', user.id)
    .maybeSingle();
  if (byId.data) return byId.data as Student;

  // Матчинг по @username: только среди непривязанных профилей в рамках cohort.
  // Telegram username регистронезависим → сравниваем lower(); ведущий '@' срезаем.
  // Привязка только при единственном совпадении (иначе неоднозначно — пропуск).
  const username = user.username?.replace(/^@/, '').toLowerCase();
  if (username) {
    const byUsername = await db
      .from(tbl('students'))
      .select('*')
      .eq('cohort', COHORT)
      .is('telegram_user_id', null)
      .ilike('telegram_username', username);
    // ilike трактует '_' как wildcard, а в Telegram-username подчёркивания
    // легальны → дофильтровываем точным равенством, чтобы 'foo_bar' не сматчил
    // 'fooXbar'. Привязываем только при единственном точном совпадении.
    const exact = (byUsername.data as Student[] | null)?.filter(
      (s) => (s.telegram_username ?? '').replace(/^@/, '').toLowerCase() === username,
    );
    if (!byUsername.error && exact && exact.length === 1) {
      const match = exact[0]!;
      const updated = await db
        .from(tbl('students'))
        .update({
          telegram_user_id: user.id,
          telegram_username: user.username ?? null,
        })
        .eq('id', match.id)
        .select('*')
        .single();
      if (updated.data) return updated.data as Student;
    }
  }

  const importKey = normalizeAuthorKey(displayName(user));
  if (importKey) {
    const byKey = await db
      .from(tbl('students'))
      .select('*')
      .eq('cohort', COHORT)
      .eq('import_key', importKey)
      .maybeSingle();
    if (byKey.data) {
      const updated = await db
        .from(tbl('students'))
        .update({
          telegram_user_id: user.id,
          telegram_username: user.username ?? null,
        })
        .eq('id', byKey.data.id)
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
      import_key: importKey || null,
      cohort: COHORT,
      is_published: true, // профиль виден всем по умолчанию, скрыть нельзя
    })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as Student;
}
