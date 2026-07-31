import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase, tbl, studentSlug, type WorkRow, type StudentRow } from '@/lib/db';
import { workScreenshotUrl, hostLabel } from '@/lib/works';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: work } = await supabase
    .from(tbl('works'))
    .select('title, description')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle<Pick<WorkRow, 'title' | 'description'>>();
  if (!work) return {};
  return {
    title: work.title,
    description: work.description ?? undefined,
    openGraph: { title: work.title, description: work.description ?? undefined },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: work } = await supabase
    .from(tbl('works'))
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle<WorkRow>();

  if (!work) notFound();

  const { data: author } = await supabase
    .from(tbl('students'))
    .select('id, display_name, telegram_username, niche, city, avatar_url')
    .eq('id', work.student_id)
    .eq('is_published', true)
    .maybeSingle<StudentRow>();

  const shot = workScreenshotUrl(work);

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
      <Link href="/" className="font-mono text-[12px] text-text3 hover:text-accent">
        ← все ученики
      </Link>

      <h1 className="font-mono text-[24px] leading-tight mt-6 mb-2">{work.title}</h1>

      {author ? (
        <Link
          href={`/s/${studentSlug(author)}`}
          className="text-[14px] text-text2 hover:text-accent"
        >
          {author.display_name}
          {author.city ? ` · ${author.city}` : ''}
        </Link>
      ) : null}

      {shot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shot}
          alt={work.title}
          className="w-full mt-6 border border-line rounded"
        />
      ) : null}

      {work.description ? (
        <p className="mt-6 text-[15px] leading-relaxed text-ink whitespace-pre-line">
          {work.description}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {work.live_url ? (
          <a
            href={work.live_url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[13px] px-4 py-2 bg-accent text-white rounded-sm"
          >
            Открыть сайт — {hostLabel(work.live_url)}
          </a>
        ) : null}
        {work.repo_url ? (
          <a
            href={work.repo_url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[13px] px-4 py-2 border border-line text-ink rounded-sm hover:border-accent hover:text-accent"
          >
            Репозиторий
          </a>
        ) : null}
      </div>

      {work.stack.length ? (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {work.stack.map((s) => (
            <span
              key={s}
              className="font-mono text-[11px] px-2 py-0.5 bg-tag-bg text-tag-text rounded-sm"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {work.screenshot_failed && work.live_url ? (
        <p className="mt-8 text-[13px] text-text3">
          Превью недоступно — сайт не отвечал в момент съёмки.
        </p>
      ) : null}
    </div>
  );
}
