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
        className="w-full aspect-[16/10] object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
      />
    );
  }

  const caption = work.live_url
    ? hostLabel(work.live_url)
    : work.repo_url
      ? hostLabel(work.repo_url)
      : 'без ссылки';

  return (
    <div className="w-full aspect-[16/10] bg-accent flex items-end p-5">
      <span className="font-display text-[13px] text-ink text-left break-all">{caption}</span>
    </div>
  );
}

export function WorkCard({ work, authorName }: { work: WorkRow; authorName?: string }) {
  return (
    <article className="group bg-surface border border-line rounded-lg overflow-hidden flex flex-col hover:border-ink hover:-translate-y-1 transition-transform">
      <Link href={`/w/${work.id}`} className="block overflow-hidden">
        <WorkThumb work={work} />
      </Link>
      <div className="p-5 flex flex-col gap-2 flex-1 border-t border-line">
        <Link href={`/w/${work.id}`} className="font-display text-[13px] leading-snug tracking-[-.02em] text-ink hover:text-accent">
          {work.title}
        </Link>
        {authorName ? <div className="font-mono text-[9px] uppercase tracking-[.06em] text-text3">{authorName}</div> : null}
        {work.description ? (
          <p className="text-[12px] leading-relaxed text-text2 line-clamp-3">{work.description}</p>
        ) : null}
        {work.stack.length ? (
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {work.stack.slice(0, 4).map((s) => (
              <span
                key={s}
                className="font-mono text-[9px] px-2 py-1 bg-tag-bg text-tag-text rounded-sm"
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
