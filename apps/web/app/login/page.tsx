import { redirect } from 'next/navigation';
import { getCurrentStudent, botUsername } from '@/lib/auth';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const me = await getCurrentStudent().catch(() => null);
  if (me) redirect('/profile');

  const bot = botUsername();

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <div className="bg-surface border border-line rounded-lg p-8 text-center">
        <div className="w-12 h-12 bg-accent rounded flex items-center justify-center text-white font-bold text-xl mx-auto mb-5">
          W
        </div>
        <h1 className="font-mono text-2xl mb-2">Вход через Telegram</h1>
        <p className="text-text2 text-sm mb-6">
          Откройте бот курса по вайб-кодингу — он подтвердит вашу личность и подтянет профиль.
        </p>
        {!bot ? (
          <p className="text-ink font-semibold text-sm">
            Бот не настроен. Укажите <code>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code> в окружении.
          </p>
        ) : (
          <LoginClient />
        )}
      </div>
    </div>
  );
}
