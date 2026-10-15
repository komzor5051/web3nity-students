import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { requireCourse } from '@/lib/courses';
import { findProject } from '@/lib/queries';
import { ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Редактирование проекта' };

export default async function EditProjectPage({ params }: { params: Promise<{ course: string; id: string }> }) {
  const { course: courseParam, id } = await params;
  const course = requireCourse(courseParam);
  const me = await requireStudent(course.id);
  const found = await findProject(id, course.id);
  // Чужой проект (или проект другого курса) не редактируется и не показывается в форме.
  if (!found || found.work.student_id !== me.id) notFound();
  return <ProjectForm course={course.id} work={found.work} />;
}
