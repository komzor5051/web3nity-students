import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { requireCourse } from '@/lib/courses';
import { visibleProjects } from '@/lib/queries';
import ProjectsCatalog from './projects-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Проекты учеников' };

export default async function ProjectsPage({ params }: { params: Promise<{ course: string }> }) {
  const course = requireCourse((await params).course);
  await requireStudent(course.id);
  const projects = await visibleProjects(course.id);
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">{course.eyebrow}</div>
        <h1>
          <span className="blue">Проекты</span> учеников
        </h1>
        <p className="lead">Найдите примеры инструментов под свою задачу.</p>
      </div>
      <ProjectsCatalog items={projects} course={course.id} />
      <div className="join" style={{ marginTop: 20 }}>
        <div>
          <h3>Поделитесь своим проектом</h3>
        </div>
        <Link className="btn action-blue" href={`/${course.id}/profile/projects/new`}>
          Добавить проект →
        </Link>
      </div>
    </>
  );
}
