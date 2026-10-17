import { NextResponse, type NextRequest } from 'next/server';
import { themeOfPath } from '@/lib/theme';

/**
 * Первый рубеж закрытой платформы: без cookie сессии любые страницы ведут на
 * вход. Полная проверка (сессия жива, человек среди учеников) — на сервере в
 * requireStudent()/getCurrentStudent() для каждой страницы и действия.
 */
const SESSION_COOKIE = 'w3n_session';
const OPEN = ['/login', '/auth/claim', '/api/auth/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Тему первого кадра серверный layout берёт из заголовка: путь ему недоступен.
  const headers = new Headers(req.headers);
  headers.set('x-theme', themeOfPath(pathname));
  const pass = () => NextResponse.next({ request: { headers } });
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p))) return pass();
  if (req.cookies.get(SESSION_COOKIE)?.value) return pass();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon|og\\.png|robots\\.txt).*)'],
};
