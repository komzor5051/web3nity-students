import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, tbl, type StudentRow, type WorkRow } from '@/lib/db';

export const revalidate = 60;

export default async function WorkPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  const { data: w } = await supabase
    .from(tbl('works'))
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (!w) notFound();

  const { data: s } = await supabase
    .from(tbl('students'))
    .select('id,display_name,telegram_username,is_published')
    .eq('id', (w as WorkRow).student_id)
    .maybeSingle();
  type StudentMini = Pick<StudentRow, 'id' | 'display_name' | 'telegram_username'> & { is_published: boolean };
  if (!s || !(s as StudentMini).is_published) notFound();

  const work = w as WorkRow;
  const student = s as StudentMini;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href={`/students/${slug}`}
        className="text-muted hover:text-cream text-sm uppercase tracking-wider"
      >
        ← К профилю {student.display_name}
      </Link>

      <h1 className="mt-6 text-3xl md:text-4xl font-bold uppercase tracking-tight">{work.title}</h1>
      {work.posted_at && (
        <div className="text-muted text-sm mt-2">
          {new Date(work.posted_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      )}

      {work.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {work.tags.map((t) => (
            <span key={t} className="text-xs uppercase tracking-wider text-muted border border-line px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      )}

      {work.description && (
        <p className="mt-8 whitespace-pre-line text-cream/90 leading-relaxed">{work.description}</p>
      )}

      <div className="mt-10 grid gap-4">
        {work.media.map((m, i) => (
          <MediaBlock key={i} m={m} />
        ))}
      </div>
    </div>
  );
}

function MediaBlock({ m }: { m: { type: string; url: string; caption?: string } }) {
  if (m.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.url} alt={m.caption ?? ''} className="w-full border border-line" />;
  }
  if (m.type === 'video') {
    return (
      <video controls className="w-full border border-line">
        <source src={m.url} />
      </video>
    );
  }
  return (
    <a
      href={m.url}
      className="block border border-line p-4 hover:border-accent text-sm uppercase tracking-wider text-cream"
    >
      {m.caption || m.url}
    </a>
  );
}
