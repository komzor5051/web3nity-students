import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { ProjectForm } from '../project-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Новый проект' };

export default async function NewProjectPage() {
  await requireStudent();
  return <ProjectForm />;
}
