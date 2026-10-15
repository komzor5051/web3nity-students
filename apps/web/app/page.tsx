import { redirect } from 'next/navigation';
import { getMemberCourses } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Корень сайта: ведём в первый курс ученика (vibecoding первым), без доступа — на вход. */
export default async function Home() {
  const courses = await getMemberCourses().catch(() => []);
  redirect(courses[0] ? `/${courses[0]}` : '/login');
}
