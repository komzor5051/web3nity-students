import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, studentSlug, tbl, type StudentRow, type WorkRow } from '@/lib/db';
import { Avatar, StatusPill } from '@/lib/components';
import { WorkCard } from '@/lib/works';

type RecItem = { recommended_id: string; reason: string | null; rank: number };
type RecStudent = Pick<StudentRow, 'id' | 'display_name' | 'niche' | 'telegram_username'>;

export const revalidate = 60;

async function findStudent(slug: string): Promise<StudentRow | null> {
  const byUsername = await supabase
    .from(tbl('students'))
    .select('*')
    .ilike('telegram_username', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (byUsername.data) return byUsername.data as StudentRow;

  const all = await supabase
    .from(tbl('students'))
    .select('*')
    .eq('is_published', true);
  if (all.error || !all.data) return null;
  const match = (all.data as StudentRow[]).find((s) => studentSlug(s) === slug);
  return match ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await findStudent(slug);
  if (!s) return {};
  return {
    title: `${s.display_name}${s.niche ? ' — ' + s.niche : ''}`,
    description: s.bio ?? `Профиль ${s.display_name} — ученик курса по вайб-кодингу.`,
    openGraph: { title: s.display_name, description: s.bio ?? undefined },
  };
}

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await findStudent(slug);
  if (!s) notFound();

  const { data: works } = await supabase
    .from(tbl('works'))
    .select('*')
    .eq('student_id', s.id)
    .eq('is_published', true)
    .order('posted_at', { ascending: false });

  const list = (works ?? []) as WorkRow[];

  const { data: recsData } = await supabase
    .from(tbl('recommendations'))
    .select('recommended_id, reason, rank')
    .eq('student_id', s.id)
    .order('rank')
    .limit(5);
  const recs = (recsData ?? []) as RecItem[];

  let recStudents: RecStudent[] = [];
  if (recs.length > 0) {
    const { data: recStudentsData } = await supabase
      .from(tbl('students'))
      .select('id, display_name, niche, telegram_username')
      .in('id', recs.map((r) => r.recommended_id))
      .eq('is_published', true);
    recStudents = (recStudentsData ?? []) as RecStudent[];
  }
  const recStudentsById = new Map(recStudents.map((r) => [r.id, r]));
  const recommendations = recs
    .map((r) => {
      const student = recStudentsById.get(r.recommended_id);
      return student ? { student, reason: r.reason } : null;
    })
    .filter((x): x is { student: RecStudent; reason: string | null } => x !== null);

  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-10 py-10 sm:py-16">
      <Link href="/#people" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.08em] text-text3 hover:text-accent">← Все участники</Link>

      <header className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-16 items-start border-b border-ink pb-12">
        <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
          <Avatar name={s.display_name} url={s.avatar_url} size={112} />
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-mono text-[9px] uppercase tracking-[.12em] text-accent mb-4">Участник курса</p>
            <h1 className="font-display text-[34px] sm:text-[48px] leading-[1.02] tracking-[-.05em] text-balance">{s.display_name}</h1>
            <div className="text-text2 mt-4 text-[14px] leading-relaxed">
              {[s.niche, [s.city, s.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Профиль участника'}
            </div>
            {s.status && <div className="mt-4"><StatusPill status={s.status} /></div>}
          </div>
        </div>
        <aside className="rounded-lg bg-ink text-white p-6 vibe-grid">
          <p className="font-display text-[15px] leading-snug">Хотите обсудить идею или проект?</p>
          <p className="text-[12px] text-white/50 mt-3 leading-relaxed">Свяжитесь с участником напрямую — без формы и посредников.</p>
          {s.telegram_username ? (
            <a href={`https://t.me/${s.telegram_username}`} className="mt-6 flex items-center justify-between rounded-sm bg-accent text-ink px-4 py-3 text-[12px] font-bold hover:bg-white" target="_blank" rel="noreferrer">
              @{s.telegram_username}<span aria-hidden="true">↗</span>
            </a>
          ) : <div className="mt-6 border-t border-white/20 pt-4 font-mono text-[10px] text-white/40">Контакт пока не указан</div>}
        </aside>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-12 lg:gap-16 items-start">
        <div>
          {s.bio && <Section title="О себе"><p className="whitespace-pre-line">{s.bio}</p></Section>}
          {s.goal && <Section title="Зачем здесь"><p className="whitespace-pre-line">{s.goal}</p></Section>}
          {s.expertise && <Section title="Экспертиза"><p className="whitespace-pre-line">{s.expertise}</p></Section>}
          {s.hobbies && <Section title="Вне работы"><p className="whitespace-pre-line">{s.hobbies}</p></Section>}
        </div>

        {recommendations.length > 0 ? (
          <aside className="lg:sticky lg:top-[102px] mt-10 border-t border-line pt-6">
            <h2 className="font-display text-[13px] mb-5">С кем познакомиться</h2>
            <ul className="space-y-5">
              {recommendations.map(({ student, reason }) => (
                <li key={student.id} className="border-b border-line pb-5 last:border-0">
                  <Link href={`/s/${studentSlug(student)}`} className="font-semibold text-[13px] text-ink hover:text-accent">{student.display_name} →</Link>
                  {student.niche ? <div className="font-mono text-[9px] uppercase tracking-[.06em] text-text3 mt-1">{student.niche}</div> : null}
                  {reason ? <p className="text-[12px] text-text2 mt-2 leading-relaxed">{reason}</p> : null}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      {list.length > 0 ? (
        <section className="mt-16 sm:mt-24 border-t border-ink pt-7">
          <div className="flex items-end justify-between gap-6 mb-8">
            <h2 className="font-display text-[24px] sm:text-[30px] tracking-[-.04em]">Работы автора</h2>
            <span className="font-mono text-[10px] text-text3">{list.length}</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((w) => <WorkCard key={w.id} work={w} />)}</div>
        </section>
      ) : (
        <section className="mt-16 border-t border-line pt-7 text-[13px] text-text3">Первая работа появится здесь после публикации.</section>
      )}

      <PersonJsonLd s={s} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 grid sm:grid-cols-[140px_minmax(0,1fr)] gap-4 sm:gap-8 border-t border-line pt-6">
      <h2 className="font-mono text-[9px] uppercase tracking-[.1em] text-text3 pt-1">{title}</h2>
      <div className="text-ink/90 text-[15px] leading-[1.8] max-w-[65ch] text-pretty">{children}</div>
    </section>
  );
}

function PersonJsonLd({ s }: { s: StudentRow }) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: s.display_name,
  };
  if (s.bio) data.description = s.bio;
  if (s.niche) data.jobTitle = s.niche;
  if (s.city || s.country) {
    data.address = {
      '@type': 'PostalAddress',
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.country ? { addressCountry: s.country } : {}),
    };
  }
  if (s.telegram_username) data.sameAs = [`https://t.me/${s.telegram_username}`];

  // Escape `</` так, чтобы JSON не сломал </script>.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
