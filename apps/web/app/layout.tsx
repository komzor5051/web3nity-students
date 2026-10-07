import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { initialOf } from '@/lib/text';
import { getCurrentStudent } from '@/lib/auth';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecoding-students.vercel.app'),
  title: 'Ученики Web3nity — люди, связи и проекты',
  description: 'Платформа учеников Web3nity: знакомьтесь, находите партнёров и клиентов, показывайте запущенные проекты.',
  openGraph: {
    title: 'Ученики Web3nity — люди, связи и проекты',
    description: 'Платформа учеников Web3nity: знакомьтесь, находите партнёров и клиентов, показывайте запущенные проекты.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Ученики Web3nity. Люди, связи и проекты.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ученики Web3nity — люди, связи и проекты',
    description: 'Платформа учеников Web3nity: знакомьтесь, находите партнёров и клиентов, показывайте запущенные проекты.',
    images: ['/og.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentStudent().catch(() => null);
  const initial = initialOf(me?.display_name);

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
              aria-label="На главную — платформа учеников Web3nity"
              className="flex items-center gap-3 font-bold select-none touch-manipulation group"
            >
              <span className="w-8 h-8 bg-accent rounded-sm shrink-0 grid place-items-center text-ink font-display text-[11px] group-hover:rotate-6">W</span>
              <span className="hidden min-[400px]:inline whitespace-nowrap font-display text-[11px] sm:text-[12px] tracking-[-.02em]">WEB3NITY</span>
            </Link>
            <nav aria-label="Основная навигация" className="flex items-center gap-4 sm:gap-8 ml-auto sm:mr-4 font-mono text-[10px] sm:text-[11px] uppercase tracking-[.08em] text-white/60">
              <Link href="/students" className="hover:text-white py-2">Участники</Link>
              <a href="/#works" className="hover:text-white py-2">Работы</a>
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
              <div className="font-display text-[12px] tracking-[-.02em]">WEB3NITY</div>
              <p className="mt-3 text-[13px] text-white/50 max-w-sm">Платформа учеников Web3nity: люди, связи и запущенные проекты.</p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[.1em] text-white/40">Сделано учениками · обновляется по мере запусков</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
