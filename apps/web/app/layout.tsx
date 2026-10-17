import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getMemberCourses } from '@/lib/auth';
import { getCourse } from '@/lib/courses';
import type { Theme } from '@/lib/theme';
import { MainShell, SiteNav, ThemeSync } from './site-nav';

const TITLE = 'Web3nity School — Платформа учеников';
const DESCRIPTION = 'Платформа учеников Web3nity School: знакомства и проекты участников курсов.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecoding-students.vercel.app'),
  title: { default: TITLE, template: `%s — ${TITLE}` },
  description: DESCRIPTION,
  // Платформа закрыта для учеников: в поиске ей делать нечего.
  robots: { index: false, follow: false },
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', images: [{ url: '/og.png?v=2', width: 1200, height: 630 }] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Шапка показывает только курсы, в которых человек числится учеником.
  const courseIds = await getMemberCourses().catch(() => []);
  const courses = courseIds.flatMap((id) => {
    const c = getCourse(id);
    return c ? [{ id: c.id, title: c.title }] : [];
  });

  const h = (await headers()).get('x-theme');
  const theme: Theme = h === 'vibe' || h === 'assistants' ? h : 'neutral';

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
      <body data-theme={theme}>
        <ThemeSync />
        <a href="#content" className="skip-link">К содержанию</a>
        <header>
          <Link href="/" className="logo" aria-label="Web3nity School — на главную">
            <i aria-hidden="true" /> Web3nity School<span>Платформа учеников</span>
          </Link>
          {courses.length ? <SiteNav courses={courses} /> : null}
        </header>
        <MainShell>{children}</MainShell>
        <footer>
          <span>Web3nity School</span>
          <span>Ученики и их проекты</span>
        </footer>
      </body>
    </html>
  );
}
