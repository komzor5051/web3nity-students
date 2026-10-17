'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isCourseId, type CourseId } from '@vibe/db/courses';
import { switchPath, themeOfPath } from '@/lib/theme';

export type NavCourse = { id: CourseId; title: string };

function current(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + '/'));
}

/** Курс из первого сегмента пути: /assistants/students -> assistants. */
function courseOfPath(path: string): CourseId | null {
  const first = path.split('/')[1];
  return isCourseId(first) ? first : null;
}

export function SiteNav({ courses }: { courses: NavCourse[] }) {
  const path = usePathname();
  // Вне курса (например, /login) шапка ведёт в первый курс ученика.
  const active = courseOfPath(path) ?? courses[0]?.id;
  if (!active) return null;
  const base = `/${active}`;
  const students = current(path, [`${base}/students`, `${base}/s`]);
  const projects = current(path, [`${base}/projects`, `${base}/w`]);
  const cabinet = current(path, [`${base}/profile`]);
  return (
    <nav aria-label="Основная навигация">
      {courses.length > 1 ? (
        <div className="course-switch" role="group" aria-label="Курс">
          {courses.map((c) => (
            <Link key={c.id} href={switchPath(path, c.id)} aria-current={c.id === active ? 'page' : undefined}>
              {c.title}
            </Link>
          ))}
        </div>
      ) : null}
      <Link href={`${base}/students`} aria-current={students ? 'page' : undefined}>Ученики</Link>
      <Link href={`${base}/projects`} aria-current={projects ? 'page' : undefined}>Проекты</Link>
      <Link className="smallbtn account signed" href={`${base}/profile`} aria-current={cabinet ? 'page' : undefined}>
        Мой профиль
      </Link>
    </nav>
  );
}

/** Главная курса и вход в прототипе имеют свои отступы у <main>. */
export function MainShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const course = courseOfPath(path);
  const isHome = course !== null && path.replace(/\/$/, '') === `/${course}`;
  const cls = isHome ? 'home-main' : path === '/login' ? 'login-main' : undefined;
  return (
    <main id="content" className={cls}>
      {children}
    </main>
  );
}

/** Корневой layout не перерисовывается при переходах между курсами: тему тела обновляем по пути. */
export function ThemeSync() {
  const path = usePathname();
  useEffect(() => {
    document.body.dataset.theme = themeOfPath(path);
  }, [path]);
  return null;
}
