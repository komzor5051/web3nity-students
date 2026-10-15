import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMemberCourses, botUsername } from '@/lib/auth';
import LoginClient from './login-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Вход' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  // Уже вошёл и учится хотя бы на одном курсе — сразу в курс.
  const courses = await getMemberCourses().catch(() => []);
  if (courses[0]) redirect(`/${courses[0]}`);
  const { denied } = await searchParams;

  return (
    <div className="login">
      <div className="eyebrow">Web3nity School</div>
      <h1>
        Платформа <span className="green">учеников</span>
      </h1>
      <p className="lead">Знакомства, общение и проекты участников курсов.</p>
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
