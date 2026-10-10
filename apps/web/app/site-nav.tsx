'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function current(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + '/'));
}

export function SiteNav() {
  const path = usePathname();
  const students = current(path, ['/students', '/s']);
  const projects = current(path, ['/projects', '/w']);
  const cabinet = current(path, ['/profile']);
  return (
    <nav aria-label="Основная навигация">
      <Link href="/students" aria-current={students ? 'page' : undefined}>Ученики</Link>
      <Link href="/projects" aria-current={projects ? 'page' : undefined}>Проекты</Link>
      <Link className="smallbtn account signed" href="/profile" aria-current={cabinet ? 'page' : undefined}>
        Мой профиль
      </Link>
    </nav>
  );
}

/** Главная и вход в прототипе имеют свои отступы у <main>. */
export function MainShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const cls = path === '/' ? 'home-main' : path === '/login' ? 'login-main' : undefined;
  return (
    <main id="content" className={cls}>
      {children}
    </main>
  );
}
