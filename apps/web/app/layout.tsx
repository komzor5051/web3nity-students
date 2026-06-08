import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentStudent } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Студенты — AI-Ассистенты 3.0',
  description: 'Витрина студентов курса AI-Ассистенты 3.0 от Web3nity. Профили, ниши, кейсы.',
  openGraph: {
    title: 'Студенты — AI-Ассистенты 3.0',
    description: 'Витрина студентов курса AI-Ассистенты 3.0 от Web3nity.',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentStudent().catch(() => null);
  const initial = me?.display_name?.[0]?.toUpperCase() ?? '?';

  return (
    <html lang="ru">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&family=Playfair+Display:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <header className="bg-surface border-b border-line h-[58px] px-6 sm:px-10 flex items-center justify-between sticky top-0 z-30">
          <Link
            href="/students"
            aria-label="На главную — участники курса"
            className="flex items-center gap-2 font-bold text-[13px] tracking-[.5px] -my-2 py-2 pr-2 select-none"
          >
            <span className="w-7 h-7 bg-accent rounded-[7px] flex items-center justify-center text-white text-[12px] shrink-0">W</span>
            <span className="whitespace-nowrap">AI-АССИСТЕНТЫ 3.0</span>
          </Link>
          <div className="flex items-center gap-3 text-[13px] text-text2">
            {me ? (
              <>
                <Link href="/profile" className="flex items-center gap-2 hover:text-ink">
                  <span className="w-[30px] h-[30px] rounded-full bg-accent text-white font-semibold text-xs flex items-center justify-center">
                    {initial}
                  </span>
                  <span className="hidden sm:inline">{me.display_name}</span>
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button className="text-[11px] text-text3 underline underline-offset-2 hover:text-accent">
                    выйти
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-full border border-line hover:border-accent hover:text-accent text-[12px]"
              >
                Войти через Telegram
              </Link>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
