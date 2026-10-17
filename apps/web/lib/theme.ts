import { getCourse, type CourseId } from '@vibe/db/courses';

export type Theme = 'neutral' | 'vibe' | 'assistants';

/** Оформление курса. Курсов без своей темы пока нет: любой новый берёт нейтральную. */
const COURSE_THEME: Record<CourseId, Theme> = {
  vibecoding: 'vibe',
  assistants: 'assistants',
};

/** Тема по пути: первый сегмент /<курс>/... задаёт тему, всё остальное (вход, 404) нейтральное. */
export function themeOfPath(path: string): Theme {
  const course = getCourse(path.split('/')[1]);
  return course ? COURSE_THEME[course.id] : 'neutral';
}

/** Страница того же типа в другом курсе. Страницы конкретных людей и проектов
 *  у курсов разные (анкета на курс), поэтому для них ведём в каталог. */
export function switchPath(path: string, target: CourseId): string {
  const rest = path.split('/').slice(2); // после /<курс>
  const [section, sub] = rest;
  const base = `/${target}`;
  switch (section) {
    case 'students':
    case 's':
      return `${base}/students`;
    case 'projects':
    case 'w':
      return `${base}/projects`;
    case 'profile':
      return sub === 'edit' ? `${base}/profile/edit` : `${base}/profile`;
    default:
      return base;
  }
}
