import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { requireCourse } from '@/lib/courses';
import { ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Новый проект' };

export default async function NewProjectPage({ params }: { params: Promise<{ course: string }> }) {
  const course = requireCourse((await params).course);
  await requireStudent(course.id);
  return <ProjectForm course={course.id} />;
}
