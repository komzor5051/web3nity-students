import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { pollAuthToken, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Magic-link входа. Кнопка бота после подтверждения ведёт сюда с ?token=<...>.
 * В отличие от опроса на /login, сессия создаётся и cookie ставится в ТОМ
 * браузере, который открыл ссылку — поэтому работает на мобиле, где вкладка
 * /login и реальный браузер не совпадают.
 *
 * Гонка с опросом /login не страшна: pollAuthToken одноразовый — кто первый,
 * тот и создал сессию. Проигравший получит expired → /login → (если уже
 * залогинен) редирект на /profile.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const origin = req.nextUrl.origin;

  if (token) {
    const result = await pollAuthToken(token);
    if (result.status === 'confirmed') {
      const jar = await cookies();
      setSessionCookie(jar, result.sessionId);
      return NextResponse.redirect(new URL('/profile', origin));
    }
  }
  return NextResponse.redirect(new URL('/login', origin));
}
