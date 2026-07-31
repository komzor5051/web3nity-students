import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentStudent } from '@/lib/auth';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecoding-students.vercel.app'),
  title: 'Сделано учениками — курс по вайб-кодингу',
  description: 'Живая витрина сайтов, сервисов и ботов, запущенных учениками курса по вайб-кодингу.',
  openGraph: {
    title: 'Сделано учениками — курс по вайб-кодингу',
    description: 'Живая витрина сайтов, сервисов и ботов, запущенных учениками курса.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Сделано учениками. Уже работает.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Сделано учениками — курс по вайб-кодингу',
    description: 'Живая витрина сайтов, сервисов и ботов, запущенных учениками курса.',
    images: ['/og.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentStudent().catch(() => null);
  const initial = me?.display_name?.[0]?.toUpperCase() ?? '?';

  return (
    <html lang="ru">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink">
        <a href="#content" className="skip-link">К содержанию</a>
        <header className="bg-ink text-white border-b border-white/10 h-[70px] px-5 sm:px-10 flex items-center sticky top-0 z-30">
          <div className="w-full max-w-[1320px] mx-auto flex items-center justify-between gap-6">
            <Link
              href="/"
              aria-label="На главную — ученики курса по вайб-кодингу"
              className="flex items-center gap-3 font-bold select-none touch-manipulation group"
            >
              <span className="w-8 h-8 bg-accent rounded-sm shrink-0 grid place-items-center text-ink font-display text-[11px] group-hover:rotate-6">V</span>
              <span className="whitespace-nowrap font-display text-[11px] sm:text-[12px] tracking-[-.02em]">ВАЙБ-КОДИНГ</span>
            </Link>
            <nav aria-label="Основная навигация" className="hidden md:flex items-center gap-8 ml-auto mr-4 font-mono text-[11px] uppercase tracking-[.08em] text-white/60">
              <a href="/#works" className="hover:text-white">Работы</a>
              <a href="/#people" className="hover:text-white">Участники</a>
            </nav>
            <div className="flex items-center gap-3 text-[13px] text-white/70">
            {me ? (
              <>
                <Link href="/profile" className="flex items-center gap-2 hover:text-white">
                  <span className="w-[32px] h-[32px] rounded-sm bg-accent text-ink font-semibold text-xs flex items-center justify-center">
                    {initial}
                  </span>
                  <span className="hidden sm:inline">{me.display_name}</span>
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button className="text-[11px] text-white/50 underline underline-offset-2 hover:text-white">
                    выйти
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3 sm:px-4 py-2 rounded-sm border border-white/20 hover:border-accent hover:bg-accent hover:text-ink text-[11px] sm:text-[12px] font-semibold"
              >
                <span className="hidden sm:inline">Войти через Telegram</span>
                <span className="sm:hidden">Войти</span>
              </Link>
            )}
            </div>
          </div>
        </header>
        <main id="content">{children}</main>
        <footer className="bg-ink text-white border-t border-white/10 px-5 sm:px-10 py-10">
          <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-8">
            <div>
              <div className="font-display text-[12px] tracking-[-.02em]">ВАЙБ-КОДИНГ</div>
              <p className="mt-3 text-[13px] text-white/50 max-w-sm">Живая витрина людей, которые учатся через практику и публикуют результат.</p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[.1em] text-white/40">Сделано учениками · обновляется по мере запусков</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
