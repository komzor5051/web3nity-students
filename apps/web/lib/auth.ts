import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { COURSE_IDS, getCourse, type CourseId } from '@vibe/db/courses';
import { tbl, type StudentRow } from './db';

export const SESSION_COOKIE = 'w3n_session';
export const AUTH_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 минут на сканирование QR / открытие бота
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 дней

let _service: SupabaseClient | null = null;

/** Service-role клиент. Используется ТОЛЬКО на сервере (server actions / API routes). */
export function serviceClient(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required');
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

export function botUsername(): string | null {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null;
}

export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** Создать одноразовый токен и deep-link для логина через бот. */
export async function createAuthToken(): Promise<{ token: string; deepLink: string | null }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS).toISOString();
  const { error } = await serviceClient()
    .from(tbl('web_auth_tokens'))
    .insert({ token, expires_at: expiresAt });
  if (error) throw error;
  const bot = botUsername();
  const deepLink = bot ? `https://t.me/${bot}?start=auth_${token}` : null;
  return { token, deepLink };
}

/** Проверить статус токена. Если подтверждён — создать сессию и удалить токен. */
export async function pollAuthToken(token: string): Promise<
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'confirmed'; sessionId: string; studentId: string }
> {
  const svc = serviceClient();
  const { data } = await svc
    .from(tbl('web_auth_tokens'))
    .select('token, student_id, confirmed_at, expires_at, denied_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return { status: 'expired' };
  // Бот не нашёл человека среди учеников курса.
  if (data.denied_at) {
    await svc.from(tbl('web_auth_tokens')).delete().eq('token', token);
    return { status: 'denied' };
  }
  if (!data.confirmed_at) {
    if (new Date(data.expires_at) < new Date()) {
      // Просроченный неподтверждённый токен больше никогда не станет валидным —
      // удаляем сразу, иначе таблица бесконечно растёт мусором.
      await svc.from(tbl('web_auth_tokens')).delete().eq('token', token);
      return { status: 'expired' };
    }
    return { status: 'pending' };
  }
  if (!data.student_id) return { status: 'expired' };

  // Вторая проверка участия — на случай старой версии бота, которая
  // подтверждала вход любому. Анкету, созданную таким входом, прячем.
  // Достаточно членства в любом курсе: какие курсы видны, решает getMemberCourses.
  const { data: student } = await svc
    .from(tbl('students'))
    .select('id, telegram_user_id, source_message_id')
    .eq('id', data.student_id)
    .maybeSingle();
  if (!student?.telegram_user_id || (await memberCourses(student.telegram_user_id)).length === 0) {
    if (student && !student.source_message_id) {
      await svc.from(tbl('students')).update({ is_published: false }).eq('id', student.id);
    }
    await svc.from(tbl('web_auth_tokens')).delete().eq('token', token);
    return { status: 'denied' };
  }

  const sessionId = generateToken(32);
  const sessExpires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ins = await svc
    .from(tbl('web_sessions'))
    .insert({ session_id: sessionId, student_id: data.student_id, expires_at: sessExpires });
  if (ins.error) throw ins.error;

  await svc.from(tbl('web_auth_tokens')).delete().eq('token', token);

  return { status: 'confirmed', sessionId, studentId: data.student_id };
}

/** Telegram ID владельца сессии или null: нет cookie, сессия истекла или анкета без Telegram. */
// cache(): шапка и страница спрашивают в одном запросе — ходим в базу один раз.
const sessionTelegramId = cache(async (): Promise<number | null> => {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const svc = serviceClient();
  const { data: sess } = await svc
    .from(tbl('web_sessions'))
    .select('session_id, student_id, expires_at')
    .eq('session_id', sid)
    .maybeSingle();
  if (!sess) return null;
  if (new Date(sess.expires_at) < new Date()) {
    await svc.from(tbl('web_sessions')).delete().eq('session_id', sid);
    return null;
  }
  // Сессия хранит student_id той анкеты, через которую вошли; по ней берём
  // человека (telegram_user_id), а анкету нужного курса ищем отдельно.
  const { data: student } = await svc
    .from(tbl('students'))
    .select('telegram_user_id')
    .eq('id', sess.student_id)
    .maybeSingle();
  const tg = student?.telegram_user_id;
  return tg ? Number(tg) : null;
});

/** Курсы, в которых человек числится учеником (доступ не закрыт). Пусто — нет сессии или доступа. */
export const getMemberCourses = cache(async (): Promise<CourseId[]> => {
  const tg = await sessionTelegramId();
  return tg ? memberCourses(tg) : [];
});

/**
 * Прочитать текущего ученика в курсе: сессия -> telegram_user_id -> анкета
 * (telegram_user_id, course), при условии что человек участник ЭТОГО курса.
 * Null — нет сессии или доступ к курсу закрыт. Это единственная точка проверки
 * доступа: все страницы и действия с данными учеников идут через неё.
 * Если человек участник курса, но анкеты в нём ещё нет, заводим пустую
 * скрытую (как раньше делал бот): появится в каталоге после заполнения формы.
 */
export const getCurrentStudent = cache(async (course: CourseId): Promise<StudentRow | null> => {
  const tg = await sessionTelegramId();
  if (!tg) return null;
  const member = await getMember(tg, course);
  if (!member) return null;
  return findOrCreateStudent(tg, course, member);
});

async function findOrCreateStudent(tg: number, course: CourseId, member: MemberRow): Promise<StudentRow> {
  const svc = serviceClient();
  const find = async () => {
    const { data } = await svc
      .from(tbl('students'))
      .select('*')
      .eq('telegram_user_id', tg)
      .eq('course', course)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as StudentRow | null) ?? null;
  };
  const existing = await find();
  if (existing) return existing;

  const { data, error } = await svc
    .from(tbl('students'))
    .insert({
      telegram_user_id: tg,
      telegram_username: member.username,
      display_name: member.display_name?.trim() || `User ${tg}`,
      cohort: getCourse(course)?.defaultCohort,
      course,
      is_published: false,
    })
    .select('*')
    .single();
  if (!error && data) return data as StudentRow;
  // Параллельный запрос успел раньше: уникальность (telegram_user_id, course).
  const raced = await find();
  if (raced) return raced;
  throw error ?? new Error('student create failed');
}

type MemberRow = { telegram_user_id: number; username: string | null; display_name: string | null };

/** Запись участника курса или null. У человека может быть по записи на каждый курс. */
export async function getMember(telegramUserId: number, course: CourseId): Promise<MemberRow | null> {
  const { data } = await serviceClient()
    .from(tbl('members'))
    .select('telegram_user_id, username, display_name')
    .eq('telegram_user_id', telegramUserId)
    .eq('course', course)
    .eq('revoked', false)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

/** Ученик ли это курса: Telegram ID в списке участников курса, доступ не закрыт. */
export async function isMember(telegramUserId: number, course: CourseId): Promise<boolean> {
  return Boolean(await getMember(telegramUserId, course));
}

/** Все курсы человека (не закрытые), в порядке реестра. */
export async function memberCourses(telegramUserId: number): Promise<CourseId[]> {
  const { data } = await serviceClient()
    .from(tbl('members'))
    .select('course')
    .eq('telegram_user_id', telegramUserId)
    .eq('revoked', false);
  const have = new Set((data ?? []).map((r) => r.course as string));
  return COURSE_IDS.filter((c) => have.has(c));
}

/**
 * Для страниц курса: без ученика этого курса — на вход. Если человек вошёл,
 * но в этом курсе не учится, ведём в его курс, а не на экран входа.
 */
export async function requireStudent(course: CourseId): Promise<StudentRow> {
  const me = await getCurrentStudent(course).catch(() => null);
  if (me) return me;
  const mine = await getMemberCourses().catch(() => []);
  redirect(mine[0] && mine[0] !== course ? `/${mine[0]}` : '/login');
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    await serviceClient().from(tbl('web_sessions')).delete().eq('session_id', sid);
  }
  jar.delete(SESSION_COOKIE);
}

export function setSessionCookie(jar: Awaited<ReturnType<typeof cookies>>, sessionId: string) {
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}
