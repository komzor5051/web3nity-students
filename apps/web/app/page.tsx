import { supabase, studentSlug, tbl, type StudentRow, type WorkRow } from '@/lib/db';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { resolveRegion } from '@/lib/region';
import { canonicalSphere, cleanBio, tgHandle } from '@/lib/text';
import { workScreenshotUrl } from '@/lib/works';
import Directory, { type DirItem, type GalleryWork } from './directory';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data, error } = await supabase
    .from(tbl('students'))
    .select(
      'id,display_name,avatar_url,city,country,niche,sphere,bio,goal,status,telegram_username,import_key,self_edited_at,updated_at',
    )
    .eq('is_published', true)
    .limit(500);

  if (error) console.error('students query failed:', error.message);

  const list = (data ?? []) as StudentRow[];

  const { data: worksData, error: worksError } = await supabase
    .from(tbl('works'))
    .select('id, student_id, title, live_url, repo_url, screenshot_path, screenshot_failed, stack, description, tags, posted_at, is_published, updated_at, media')
    .eq('is_published', true)
    .order('posted_at', { ascending: false });

  if (worksError) console.error('works query failed:', worksError.message);

  const worksByStudent = new Map<string, WorkRow[]>();
  for (const w of (worksData ?? []) as WorkRow[]) {
    const items = worksByStudent.get(w.student_id) ?? [];
    items.push(w);
    worksByStudent.set(w.student_id, items);
  }

  const me = await getCurrentStudent().catch(() => null);
  const myId = me?.id ?? null;

  // В каталог попадают только те, у кого есть что показать: работа, рассказ о
  // себе или собственноручно заполненный профиль. Люди, которых парсер нашёл в
  // чате, но которые ничего о себе не сказали, витрине ничего не дают — они
  // появятся сами, когда войдут через Telegram и заполнят профиль.
  const registered = list.filter(
    (s) => (worksByStudent.get(s.id)?.length ?? 0) > 0 || Boolean(s.bio) || Boolean(s.self_edited_at),
  );

  const items: DirItem[] = registered.map((s) => ({
    id: s.id,
    slug: studentSlug(s),
    name: s.display_name,
    city: s.city,
    country: s.country,
    region: resolveRegion(s.city, s.country),
    niche: s.niche,
    sphere: canonicalSphere(s.sphere),
    bio: cleanBio(s.bio),
    goal: cleanBio(s.goal),
    status: s.status,
    telegram: tgHandle(s.telegram_username),
    avatarUrl: s.avatar_url,
    workCount: worksByStudent.get(s.id)?.length ?? 0,
  }));

  const studentById = new Map(list.map((s) => [s.id, s]));
  const gallery: GalleryWork[] = ((worksData ?? []) as WorkRow[]).flatMap((w) => {
    const author = studentById.get(w.student_id);
    // Работа без опубликованного автора на витрине не показывается: карточка
    // без имени не даёт того, ради чего витрина сделана, — контакта.
    if (!author) return [];
    return [
      {
        id: w.id,
        title: w.title,
        description: w.description,
        liveUrl: w.live_url,
        repoUrl: w.repo_url,
        screenshotUrl: workScreenshotUrl(w),
        stack: w.stack ?? [],
        authorId: author.id,
        authorName: author.display_name,
        authorSlug: studentSlug(author),
      },
    ];
  });

  let recommendations: { item: DirItem; reason: string | null }[] = [];
  if (myId) {
    const { data: recsData } = await serviceClient()
      .from(tbl('recommendations'))
      .select('recommended_id, reason, rank')
      .eq('student_id', myId)
      .order('rank', { ascending: true });
    const recs = (recsData ?? []) as { recommended_id: string; reason: string | null; rank: number }[];
    const byId = new Map(items.map((i) => [i.id, i]));
    recommendations = recs
      .map((r) => {
        const item = byId.get(r.recommended_id);
        return item ? { item, reason: r.reason } : null;
      })
      .filter((x): x is { item: DirItem; reason: string | null } => x !== null);
  }

  return <Directory items={items} works={gallery} myId={myId} recommendations={recommendations} />;
}
