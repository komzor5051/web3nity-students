import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { findProject } from '@/lib/queries';
import { ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Редактирование проекта' };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStudent();
  const work = await findProject((await params).id);
  // Чужой проект не редактируется и не показывается в форме.
  if (!work || work.student_id !== me.id) notFound();
  return <ProjectForm work={work} />;
}
