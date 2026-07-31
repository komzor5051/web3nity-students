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
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/" className="text-text2 hover:text-ink text-sm uppercase tracking-wider">
        ← К списку
      </Link>

      <header className="mt-6 flex items-start gap-6">
        <Avatar name={s.display_name} url={s.avatar_url} size={96} />
        <div className="flex-1 min-w-0">
          <h1 className="font-mono text-3xl md:text-4xl font-bold uppercase tracking-tight">{s.display_name}</h1>
          <div className="text-text2 mt-2">
            {[s.niche, [s.city, s.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
          </div>
          {s.telegram_username ? (
            <a
              href={`https://t.me/${s.telegram_username}`}
              className="font-mono text-[13px] text-accent hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              @{s.telegram_username}
            </a>
          ) : null}
          {s.status && <div className="mt-3"><StatusPill status={s.status} /></div>}
        </div>
      </header>

      {s.bio && (
        <Section title="О себе">
          <p className="whitespace-pre-line">{s.bio}</p>
        </Section>
      )}
      {s.goal && (
        <Section title="Зачем здесь">
          <p className="whitespace-pre-line">{s.goal}</p>
        </Section>
      )}
      {s.expertise && (
        <Section title="Экспертиза">
          <p className="whitespace-pre-line">{s.expertise}</p>
        </Section>
      )}
      {s.hobbies && (
        <Section title="Хобби">
          <p className="whitespace-pre-line">{s.hobbies}</p>
        </Section>
      )}

      {list.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-mono text-[13px] uppercase tracking-[.08em] text-text3 mb-4">
            Работы
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {list.map((w) => (
              <WorkCard key={w.id} work={w} />
            ))}
          </div>
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-mono text-[13px] uppercase tracking-[.08em] text-text3 mb-4">
            С кем познакомиться
          </h2>
          <ul className="space-y-3">
            {recommendations.map(({ student, reason }) => (
              <li key={student.id}>
                <Link
                  href={`/s/${studentSlug(student)}`}
                  className="font-semibold text-[14px] text-ink hover:text-accent"
                >
                  {student.display_name}
                </Link>
                {student.niche ? (
                  <span className="text-[13px] text-text3"> · {student.niche}</span>
                ) : null}
                {reason ? <p className="text-[13px] text-text2 mt-0.5">{reason}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PersonJsonLd s={s} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="font-mono text-xs uppercase tracking-widest text-text2 mb-3">{title}</h2>
      <div className="text-ink/90 leading-relaxed">{children}</div>
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
