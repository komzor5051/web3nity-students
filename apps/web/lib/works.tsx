import Link from 'next/link';
import type { WorkRow } from './db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const BUCKET_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_PREFIX ?? '';

export function workScreenshotUrl(work: Pick<WorkRow, 'screenshot_path'>): string | null {
  if (!work.screenshot_path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_PREFIX}works-media/${work.screenshot_path}`;
}

/** Домен без протокола и www — подпись под карточкой. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Превью работы. Три состояния: скриншот есть; скриншот снять не удалось;
 * работа вообще не сайт. Во всех случаях блок одного размера — сетка не прыгает.
 */
export function WorkThumb({ work }: { work: WorkRow }) {
  const src = workScreenshotUrl(work);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={work.title}
        className="w-full aspect-[16/10] object-cover object-top border-b border-line"
      />
    );
  }

  const caption = work.live_url
    ? hostLabel(work.live_url)
    : work.repo_url
      ? hostLabel(work.repo_url)
      : 'без ссылки';

  return (
    <div className="w-full aspect-[16/10] border-b border-line bg-accent-light flex items-center justify-center px-4">
      <span className="font-mono text-[13px] text-accent text-center break-all">{caption}</span>
    </div>
  );
}

export function WorkCard({ work, authorName }: { work: WorkRow; authorName?: string }) {
  return (
    <article className="bg-surface border border-line rounded overflow-hidden flex flex-col">
      <Link href={`/w/${work.id}`} className="block">
        <WorkThumb work={work} />
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <Link href={`/w/${work.id}`} className="font-mono text-[14px] text-ink hover:text-accent">
          {work.title}
        </Link>
        {authorName ? <div className="text-[13px] text-text2">{authorName}</div> : null}
        {work.description ? (
          <p className="text-[13px] text-text2 line-clamp-3">{work.description}</p>
        ) : null}
        {work.stack.length ? (
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {work.stack.slice(0, 4).map((s) => (
              <span
                key={s}
                className="font-mono text-[11px] px-2 py-0.5 bg-tag-bg text-tag-text rounded-sm"
              >
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
