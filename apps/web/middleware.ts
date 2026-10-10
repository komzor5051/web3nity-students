import { NextResponse, type NextRequest } from 'next/server';

/**
 * Первый рубеж закрытой платформы: без cookie сессии любые страницы ведут на
 * вход. Полная проверка (сессия жива, человек среди учеников) — на сервере в
 * requireStudent()/getCurrentStudent() для каждой страницы и действия.
 */
const SESSION_COOKIE = 'w3n_session';
const OPEN = ['/login', '/auth/claim', '/api/auth/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon|og\\.png|robots\\.txt).*)'],
};
