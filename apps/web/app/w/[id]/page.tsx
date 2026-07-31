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
    <div className="max-w-[1180px] mx-auto px-5 sm:px-10 py-10 sm:py-16">
      <Link href="/#works" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.08em] text-text3 hover:text-accent">← Все работы</Link>

      <header className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-16 items-end border-b border-ink pb-10">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.12em] text-accent mb-4">Проект ученика</p>
          <h1 className="font-display text-[34px] sm:text-[52px] leading-[1] tracking-[-.05em] text-balance">{work.title}</h1>
        </div>
        {author ? (
          <Link href={`/s/${studentSlug(author)}`} className="group rounded-lg bg-surface border border-line p-4 flex items-center justify-between gap-4 hover:border-ink">
            <span><span className="block font-mono text-[9px] uppercase tracking-[.08em] text-text3 mb-1">Автор</span><span className="text-[13px] font-bold group-hover:text-accent">{author.display_name}</span>{author.city ? <span className="block text-[11px] text-text3 mt-1">{author.city}</span> : null}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </header>

      {shot ? (
        <div className="mt-8 sm:mt-12 rounded-lg bg-ink p-2 sm:p-4 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt={work.title} className="w-full rounded-sm object-cover object-top" />
        </div>
      ) : (
        <div className="mt-8 sm:mt-12 rounded-lg bg-accent min-h-[320px] grid place-items-center p-8"><span className="font-display text-[24px] text-ink text-center">{work.live_url ? hostLabel(work.live_url) : work.title}</span></div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-16 mt-10 sm:mt-14 items-start">
        <div>
          {work.description ? <p className="text-[15px] sm:text-[17px] leading-[1.8] text-ink whitespace-pre-line max-w-[65ch] text-pretty">{work.description}</p> : <p className="text-[14px] text-text3">Автор пока не добавил описание проекта.</p>}
          {work.stack.length ? (
            <div className="mt-8 flex flex-wrap gap-2">{work.stack.map((s) => <span key={s} className="font-mono text-[10px] px-2.5 py-1 bg-tag-bg text-tag-text rounded-sm">{s}</span>)}</div>
          ) : null}
        </div>
        <aside className="rounded-lg bg-surface border border-line p-5">
          <p className="font-display text-[13px]">Посмотреть проект</p>
          <div className="mt-4 flex flex-col gap-2">
            {work.live_url ? <a href={work.live_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-sm bg-accent text-ink px-4 py-3 text-[11px] font-bold hover:bg-ink hover:text-white">Открыть сайт <span aria-hidden="true">↗</span></a> : null}
            {work.repo_url ? <a href={work.repo_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-sm border border-line px-4 py-3 text-[11px] font-semibold hover:border-ink">Репозиторий <span aria-hidden="true">↗</span></a> : null}
          </div>
          {work.screenshot_failed && work.live_url ? <p className="mt-4 text-[11px] leading-relaxed text-text3">Превью недоступно — сайт не отвечал в момент съёмки.</p> : null}
        </aside>
      </div>
    </div>
  );
}
