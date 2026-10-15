/**
 * Чтения для страниц платформы. Вызываются только после requireStudent():
 * сам модуль доступ не проверяет, он работает через service-клиент.
 */
import { serviceClient } from './auth';
import { studentSlug, tbl, type StudentRow, type WorkRow } from './db';
import { BASE_SPHERES, toProjectCard, toStudentCard, type ProjectCardData } from './catalog';
import type { CourseId } from '@vibe/db/courses';
import { canonicalSphere } from './text';

/** Опубликованные анкеты ОДНОГО курса: базы курсов не смешиваются. */
export async function publishedStudents(course: CourseId): Promise<StudentRow[]> {
  // Два независимых запроса — параллельно: база в Сеуле, каждый круг заметен.
  const [{ data, error }, { data: members, error: mErr }] = await Promise.all([
    serviceClient().from(tbl('students')).select('*').eq('course', course).eq('is_published', true).limit(1000),
    serviceClient().from(tbl('members')).select('telegram_user_id').eq('course', course).eq('revoked', false).limit(5000),
  ]);
  if (error) throw new Error(`students: ${error.message}`);
  if (mErr) throw new Error(`members: ${mErr.message}`);
  const ids = new Set((members ?? []).map((m) => Number(m.telegram_user_id)));
  // Анкета из импорта чатов — ученик по определению. Анкета, заведённая
  // входом через бота, видна, только если человек среди участников курса.
  return ((data ?? []) as StudentRow[]).filter(
    (s) => s.source_message_id || !s.telegram_user_id || ids.has(Number(s.telegram_user_id)),
  );
}

/** Проекты курса, видимые ученикам: опубликованы, не скрыты организатором, автор в каталоге курса. */
export async function visibleProjects(course: CourseId, authors?: StudentRow[]): Promise<ProjectCardData[]> {
  const people = authors ?? (await publishedStudents(course));
  const byId = new Map(people.map((s) => [s.id, s]));
  // Курс работы следует из автора: ниже остаются только работы авторов этого курса
  // (.in() по тысяче uuid упёрся бы в длину URL, поэтому фильтруем по byId).
  const { data, error } = await serviceClient()
    .from(tbl('works'))
    .select('*')
    .eq('is_published', true)
    .eq('hidden_by_admin', false)
    .order('posted_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`works: ${error.message}`);
  const cards = ((data ?? []) as WorkRow[]).flatMap((w) => {
    const a = byId.get(w.student_id);
    return a ? [toProjectCard(w, a)] : [];
  });
  // Проекты с предпросмотром — выше, внутри групп порядок по дате сохраняется.
  return cards.sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)));
}

/** Slug уникален только внутри курса: ищем всегда с фильтром по курсу. */
export async function findStudentBySlug(course: CourseId, slug: string): Promise<StudentRow | null> {
  const svc = serviceClient();
  const byUsername = await svc
    .from(tbl('students'))
    .select('*')
    .eq('course', course)
    .ilike('telegram_username', slug.replace(/[%_]/g, '\\$&'))
    .eq('is_published', true)
    .limit(1)
    .maybeSingle();
  if (byUsername.data) return byUsername.data as StudentRow;
  const all = await publishedStudents(course);
  return all.find((s) => studentSlug(s) === slug) ?? null;
}

export async function projectsOf(studentId: string, includeHidden: boolean): Promise<WorkRow[]> {
  let q = serviceClient().from(tbl('works')).select('*').eq('student_id', studentId);
  if (!includeHidden) q = q.eq('is_published', true).eq('hidden_by_admin', false);
  const { data, error } = await q.order('posted_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`works: ${error.message}`);
  return (data ?? []) as WorkRow[];
}

/** Работа и её автор, но только если автор в этом курсе; чужой курс — null (404). */
export async function findProject(id: string, course: CourseId): Promise<{ work: WorkRow; author: StudentRow } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await serviceClient().from(tbl('works')).select('*').eq('id', id).maybeSingle();
  const work = (data as WorkRow | null) ?? null;
  if (!work) return null;
  const author = await findStudentById(work.student_id, course);
  return author ? { work, author } : null;
}

export async function findStudentById(id: string, course: CourseId): Promise<StudentRow | null> {
  const { data } = await serviceClient().from(tbl('students')).select('*').eq('id', id).eq('course', course).maybeSingle();
  return (data as StudentRow | null) ?? null;
}

/** Сферы для фильтра и формы: набор прототипа + то, что реально встречается в базе. */
export function sphereOptions(students: StudentRow[]): string[] {
  const fromDb = students.map((s) => canonicalSphere(s.sphere)).filter((x): x is string => Boolean(x));
  const extra = [...new Set(fromDb)].filter((x) => !BASE_SPHERES.includes(x)).sort((a, b) => a.localeCompare(b, 'ru'));
  return [...BASE_SPHERES, ...extra];
}

export { toStudentCard };
