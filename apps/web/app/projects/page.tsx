import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { visibleProjects } from '@/lib/queries';
import ProjectsCatalog from './projects-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Проекты учеников' };

export default async function ProjectsPage() {
  await requireStudent();
  const projects = await visibleProjects();
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Практикум «Вайбкодинг»</div>
        <h1>
          <span className="blue">Проекты</span> учеников
        </h1>
        <p className="lead">Найдите примеры инструментов под свою задачу.</p>
      </div>
      <ProjectsCatalog items={projects} />
      <div className="join" style={{ marginTop: 20 }}>
        <div>
          <h3>Поделитесь своим проектом</h3>
        </div>
        <Link className="btn action-blue" href="/profile/projects/new">
          Добавить проект →
        </Link>
      </div>
    </>
  );
}
