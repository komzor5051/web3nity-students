import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { studentSlug, tbl, type StudentRow } from '@/lib/db';
import { Avatar } from '@/lib/components';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Рекомендации — AI-Ассистенты 3.0',
};

type RecRow = { recommended_id: string; reason: string | null; rank: number };

export default async function RecommendationsPage() {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) redirect('/login');

  const svc = serviceClient();
  const { data: recsData } = await svc
    .from(tbl('recommendations'))
    .select('recommended_id, reason, rank')
    .eq('student_id', me.id)
    .order('rank', { ascending: true });
  const recs = (recsData ?? []) as RecRow[];

  const ids = recs.map((r) => r.recommended_id);
  const studentsById = new Map<string, StudentRow>();
  if (ids.length > 0) {
    const { data: studentsData } = await svc
      .from(tbl('students'))
      .select('*')
      .in('id', ids)
      .eq('is_published', true);
    for (const s of (studentsData ?? []) as StudentRow[]) studentsById.set(s.id, s);
  }

  const items = recs
    .map((r) => ({ rec: r, student: studentsById.get(r.recommended_id) }))
    .filter((x): x is { rec: RecRow; student: StudentRow } => Boolean(x.student));

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/students"
        className="text-text3 hover:text-accent text-sm inline-flex items-center gap-1"
      >
        ← Ко всем участникам
      </Link>

      <header className="mt-5 mb-7">
        <h1 className="font-display text-[28px] mb-1.5">Рекомендации для вас</h1>
        <p className="text-text2 text-sm">
          Участники курса, с которыми вам стоит познакомиться — подобраны по нише, целям и опыту.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <p className="text-text2 text-sm">
            Рекомендаций пока нет. Они появятся после ближайшего обновления — и станут точнее,
            когда вы заполните профиль на странице{' '}
            <Link href="/profile" className="text-accent underline underline-offset-2">
              профиля
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ rec, student }) => (
            <li
              key={student.id}
              className="bg-surface border border-line rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <Avatar name={student.display_name} url={student.avatar_url} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{student.display_name}</div>
                  <div className="text-text3 text-[13px]">
                    {[student.niche, student.city || student.country]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>

                  {rec.reason && (
                    <div className="mt-3 flex gap-2 rounded bg-accent-light/70 px-3 py-2">
                      <span className="text-accent shrink-0 mt-px">›</span>
                      <p className="text-[13px] text-tag-text leading-snug">{rec.reason}</p>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    {student.telegram_username && (
                      <a
                        href={`https://t.me/${student.telegram_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-accent text-white hover:bg-accent-dark"
                      >
                        Написать в Telegram
                      </a>
                    )}
                    <Link
                      href={`/students/${studentSlug(student)}`}
                      className="text-xs px-3 py-1.5 rounded-full border border-line text-text2 hover:border-accent hover:text-accent"
                    >
                      Открыть профиль
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
