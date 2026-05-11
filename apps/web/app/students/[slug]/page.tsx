import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, studentSlug, tbl, type StudentRow, type WorkRow } from '@/lib/db';
import { Avatar, StatusPill } from '@/lib/components';

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
    description: s.bio ?? `Профиль ${s.display_name} в витрине курса AI-Ассистенты 3.0.`,
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/students" className="text-muted hover:text-cream text-sm uppercase tracking-wider">
        ← К списку
      </Link>

      <header className="mt-6 flex items-start gap-6">
        <Avatar name={s.display_name} url={s.avatar_url} size={96} />
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-tight">{s.display_name}</h1>
          <div className="text-muted mt-2">
            {[s.niche, [s.city, s.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
          </div>
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

      {s.telegram_username && (
        <Section title="Связаться">
          <a
            href={`https://t.me/${s.telegram_username}`}
            className="inline-block bg-accent text-cream px-5 py-2 uppercase tracking-wider text-sm"
          >
            @{s.telegram_username}
          </a>
        </Section>
      )}

      <Section title="Работы">
        {list.length === 0 ? (
          <p className="text-muted">Скоро тут появятся кейсы. Студент только начал курс.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((w) => (
              <li key={w.id}>
                <WorkCard slug={studentSlug(s)} w={w} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PersonJsonLd s={s} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-xs uppercase tracking-widest text-muted mb-3">{title}</h2>
      <div className="text-cream/90 leading-relaxed">{children}</div>
    </section>
  );
}

function WorkCard({ slug, w }: { slug: string; w: WorkRow }) {
  const cover = w.media.find((m) => m.type === 'image');
  return (
    <Link
      href={`/students/${slug}/works/${w.id}`}
      className="block border border-line hover:border-accent transition-colors"
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt={w.title} className="w-full aspect-video object-cover border-b border-line" />
      )}
      <div className="p-4">
        <div className="font-bold text-cream">{w.title}</div>
        {w.description && (
          <p className="text-sm text-cream/70 mt-2 line-clamp-3">{w.description}</p>
        )}
        {w.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {w.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-xs uppercase tracking-wider text-muted border border-line px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
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
