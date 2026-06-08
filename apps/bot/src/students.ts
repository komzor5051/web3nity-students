/**
 * Логика работы со студентами в боте: матчинг по telegram_user_id (live)
 * или по import_key (имя из HTML-импорта). Создание / обновление профиля.
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
 * 3. Иначе — по (cohort, import_key) — матчим импортированный профиль и
 *    проставляем telegram_user_id + telegram_username.
 * 4. Иначе — создаём нового, is_published=false до получения /agree.
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
  // Привязка только при единственном совпадении (иначе неоднозначно — пропуск,
  // как в reconcileFromChat).
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
      is_published: false, // до явного /agree
    })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as Student;
}

export async function updateStudentField(
  db: SupabaseClient,
  studentId: string,
  patch: Partial<Student>,
): Promise<void> {
  const { error } = await db.from(tbl('students')).update(patch).eq('id', studentId);
  if (error) throw error;
}

export async function setPublished(
  db: SupabaseClient,
  studentId: string,
  value: boolean,
): Promise<void> {
  await updateStudentField(db, studentId, { is_published: value });
}

export async function deleteStudent(db: SupabaseClient, tgId: number): Promise<void> {
  // works удаляются каскадом, raw_messages остаются для аудита
  // (по требованию заказчика). Если нужен полный wipe — заменить на rpc.
  await db.from(tbl('students')).delete().eq('telegram_user_id', tgId);
  await db.from(tbl('bot_sessions')).delete().eq('telegram_user_id', tgId);
}

// Кого уже сматчили за время жизни процесса — не дёргаем БД повторно.
const reconciled = new Set<number>();

/**
 * Пассивная реконсиляция при чтении чата курса: дозаписывает telegram_user_id
 * и telegram_username импортированному профилю, не создавая новых записей и
 * не публикуя ничего. Вызывается на каждом сообщении из чата (Privacy Mode off).
 *
 * Логика:
 * - если профиль уже привязан по tg_id → при необходимости обновляем username;
 * - иначе ищем импортированный профиль по (cohort, import_key) без tg_id;
 *   привязываем ТОЛЬКО если совпадение ровно одно (иначе неоднозначно — пропуск).
 */
export async function reconcileFromChat(db: SupabaseClient, user: TgUser): Promise<void> {
  if (reconciled.has(user.id)) return;

  const byId = await db
    .from(tbl('students'))
    .select('id, telegram_username')
    .eq('telegram_user_id', user.id)
    .maybeSingle();
  if (byId.data) {
    if (user.username && byId.data.telegram_username !== user.username) {
      await db.from(tbl('students')).update({ telegram_username: user.username }).eq('id', byId.data.id);
    }
    reconciled.add(user.id);
    return;
  }

  const importKey = normalizeAuthorKey(displayName(user));
  if (!importKey) return;

  const matches = await db
    .from(tbl('students'))
    .select('id')
    .eq('cohort', COHORT)
    .eq('import_key', importKey)
    .is('telegram_user_id', null);
  if (matches.error || !matches.data || matches.data.length !== 1) {
    // нет совпадения или неоднозначно — не трогаем, пусть зайдёт в бота сам
    return;
  }

  await db
    .from(tbl('students'))
    .update({ telegram_user_id: user.id, telegram_username: user.username ?? null })
    .eq('id', matches.data[0]!.id);
  reconciled.add(user.id);
}
