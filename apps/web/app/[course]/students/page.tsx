import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { byCompleteness, toStudentCard } from '@/lib/catalog';
import { requireCourse } from '@/lib/courses';
import { publishedStudents, sphereOptions } from '@/lib/queries';
import StudentsCatalog from './students-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ученики' };

export default async function StudentsPage({ params }: { params: Promise<{ course: string }> }) {
  const course = requireCourse((await params).course);
  await requireStudent(course.id);
  const students = await publishedStudents(course.id);
  const cards = students.map(toStudentCard).sort(byCompleteness);
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">{course.eyebrow}</div>
        <h1>
          <span className="green">Ученики</span> курса
        </h1>
        <p className="lead">Найдите людей с похожими интересами и познакомьтесь ближе.</p>
      </div>
      <StudentsCatalog items={cards} spheres={sphereOptions(students)} course={course.id} />
    </>
  );
}
