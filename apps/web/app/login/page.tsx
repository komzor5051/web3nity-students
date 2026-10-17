import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMemberCourses, botUsername, sessionTelegramId } from '@/lib/auth';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Вход' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  // Уже вошёл и учится хотя бы на одном курсе — сразу в курс.
  const courses = await getMemberCourses().catch(() => []);
  if (courses[0]) redirect(`/${courses[0]}`);
  const { denied } = await searchParams;
  // Сессия есть, а курсов нет: доступ закрыт или человека убрали из списка.
  const signedIn = Boolean(await sessionTelegramId().catch(() => null));

  return (
    <div className="login">
      <div className="eyebrow">Web3nity School</div>
      <h1>Платформа учеников</h1>
      <p className="lead">
        Находите партнёров, клиентов и единомышленников по профессиональным интересам. Изучайте проекты других
        учеников и делитесь своими.
      </p>
      {signedIn ? (
        <div role="alert">
          <p className="demo">
            У этого Telegram-аккаунта нет доступа к курсам. Обратитесь к менеджеру школы, чтобы вас добавили.
          </p>
          <form action="/api/auth/logout" method="POST">
            <button className="btn" type="submit">
              Войти с другого аккаунта
            </button>
          </form>
        </div>
      ) : !botUsername() ? (
        <p className="notice error" role="alert">
          Вход временно недоступен: бот не настроен. Сообщите организатору.
        </p>
      ) : (
        <LoginClient initiallyDenied={denied === '1'} />
      )}
    </div>
  );
}
