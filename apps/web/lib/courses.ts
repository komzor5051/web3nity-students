import { notFound } from 'next/navigation';
import { getCourse, type Course, type CourseId } from '@vibe/db/courses';

// Реестр курсов живёт в @vibe/db (общий с ботом и скриптами).
export * from '@vibe/db/courses';

/** Курс из сегмента URL /[course]/...; неизвестный — 404. */
export function requireCourse(param: string): Course {
  const course = getCourse(param);
  if (!course) notFound();
  return course;
}

/** Путь внутри курса: coursePath('vibecoding', '/students') -> /vibecoding/students. */
export function coursePath(course: CourseId, path = ''): string {
  return `/${course}${path}`;
}
