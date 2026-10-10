import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

  const sessionId = generateToken(32);
  const sessExpires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const ins = await svc
    .from(tbl('web_sessions'))
    .insert({ session_id: sessionId, student_id: data.student_id, expires_at: sessExpires });
  if (ins.error) throw ins.error;

  await svc.from(tbl('web_auth_tokens')).delete().eq('token', token);

  return { status: 'confirmed', sessionId, studentId: data.student_id };
}

/**
 * Прочитать текущего ученика по cookie. Возвращает null, если сессии нет,
 * она истекла или человек больше не числится среди участников курса
 * (организатор закрыл доступ). Это единственная точка проверки доступа:
 * все страницы и действия с данными учеников идут через неё.
 */
export async function getCurrentStudent(): Promise<StudentRow | null> {
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
  const { data: student } = await svc
    .from(tbl('students'))
    .select('*')
    .eq('id', sess.student_id)
    .maybeSingle();
  const me = (student as StudentRow | null) ?? null;
  if (!me?.telegram_user_id) return null;
  const { data: member } = await svc
    .from(tbl('members'))
    .select('telegram_user_id')
    .eq('telegram_user_id', me.telegram_user_id)
    .eq('revoked', false)
    .maybeSingle();
  return member ? me : null;
}

/** Для страниц: без подтверждённого ученика — на экран входа. */
export async function requireStudent(): Promise<StudentRow> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) redirect('/login');
  return me;
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
