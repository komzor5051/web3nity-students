import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { byCompleteness, toStudentCard } from '@/lib/catalog';
import { publishedStudents, sphereOptions } from '@/lib/queries';
import StudentsCatalog from './students-catalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ученики' };

export default async function StudentsPage() {
  await requireStudent();
  const students = await publishedStudents();
  const cards = students.map(toStudentCard).sort(byCompleteness);
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">Практикум «Вайбкодинг»</div>
        <h1>
          <span className="green">Ученики</span> практикума
        </h1>
        <p className="lead">Найдите людей с похожими интересами и познакомьтесь ближе.</p>
      </div>
      <StudentsCatalog items={cards} spheres={sphereOptions(students)} />
    </>
  );
}
