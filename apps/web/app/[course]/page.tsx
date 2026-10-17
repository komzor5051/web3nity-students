import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { requireCourse } from '@/lib/courses';

export const dynamic = 'force-dynamic';

export default async function CourseHome({ params }: { params: Promise<{ course: string }> }) {
  const course = requireCourse((await params).course);
  await requireStudent(course.id);
  return (
    <section className="compact-home">
      <div className="eyebrow">{course.eyebrow}</div>
      <h1>
        Рады видеть <span className="green">вас.</span>
      </h1>
      <p className="lead">Знакомьтесь и делитесь результатами обучения.</p>
      <div className="routes">
        <Link className="route" href={`/${course.id}/students`}>
          <span className="number">01 / ЗНАКОМСТВА</span>
          <h2>Ученики</h2>
          <p>Найдите людей с похожими интересами.</p>
          <span className="btn">Посмотреть учеников →</span>
        </Link>
        <Link className="route" href={`/${course.id}/projects`}>
          <span className="number">02 / РЕЗУЛЬТАТЫ</span>
          <h2>Проекты учеников</h2>
          <p>Посмотрите, что создают участники.</p>
          <span className="btn">Посмотреть проекты →</span>
        </Link>
      </div>
    </section>
  );
}
