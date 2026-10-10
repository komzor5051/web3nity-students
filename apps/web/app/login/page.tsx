import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentStudent, botUsername } from '@/lib/auth';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Вход' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await getCurrentStudent().catch(() => null);
  if (me) redirect('/');
  const { denied } = await searchParams;

  return (
    <div className="login">
      <div className="eyebrow">Практикум «Вайбкодинг»</div>
      <h1>
        Платформа <span className="green">учеников</span>
      </h1>
      <p className="lead">Знакомства, общение и проекты участников практикума.</p>
      {!botUsername() ? (
        <p className="notice error" role="alert">
          Вход временно недоступен: бот не настроен. Сообщите организатору.
        </p>
      ) : (
        <LoginClient initiallyDenied={denied === '1'} />
      )}
    </div>
  );
}
