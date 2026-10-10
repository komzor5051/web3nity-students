import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentStudent } from '@/lib/auth';
import { MainShell, SiteNav } from './site-nav';

const TITLE = 'Web3nity School — Практикум «Вайбкодинг»';
const DESCRIPTION = 'Платформа учеников практикума «Вайбкодинг» Web3nity School: знакомства и проекты участников.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecoding-students.vercel.app'),
  title: { default: TITLE, template: `%s — ${TITLE}` },
  description: DESCRIPTION,
  // Платформа закрыта для учеников: в поиске ей делать нечего.
  robots: { index: false, follow: false },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', images: [{ url: '/og.png', width: 1200, height: 630 }] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentStudent().catch(() => null);

  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#content" className="skip-link">К содержанию</a>
        <header>
          <Link href="/" className="logo" aria-label="Web3nity School — на главную">
            <i aria-hidden="true" /> Web3nity School<span>Практикум «Вайбкодинг»</span>
          </Link>
          {me ? <SiteNav /> : null}
        </header>
        <MainShell>{children}</MainShell>
        <footer>
          <span>Web3nity School · Практикум «Вайбкодинг»</span>
          <span>Ученики и их проекты</span>
        </footer>
      </body>
    </html>
  );
}
