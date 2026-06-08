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
 * Гонка с опросом /login безвредна: pollAuthToken создаёт независимую сессию,
 * обе валидны.
 */

/**
 * Относительный Location: браузер резолвит от публичного домена, с которого
 * пришёл запрос. Не используем NextResponse.redirect / req.url — за прокси
 * Railway origin = внутренний 0.0.0.0:8080 и ломает редирект.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token) {
    const result = await pollAuthToken(token);
    if (result.status === 'confirmed') {
      const jar = await cookies();
      setSessionCookie(jar, result.sessionId);
      return redirectTo('/profile');
    }
  }
  return redirectTo('/login');
}
