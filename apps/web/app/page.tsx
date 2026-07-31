import { supabase, studentSlug, tbl, type StudentRow, type WorkRow } from '@/lib/db';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { resolveRegion } from '@/lib/region';
import Directory, { type DirItem } from './directory';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data, error } = await supabase
    .from(tbl('students'))
    .select(
      'id,display_name,avatar_url,city,country,niche,sphere,bio,goal,status,telegram_username,import_key,updated_at',
    )
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) console.error('students query failed:', error.message);

  const list = (data ?? []) as StudentRow[];

  const { data: worksData, error: worksError } = await supabase
    .from(tbl('works'))
    .select('id, student_id, title, live_url, repo_url, screenshot_path, screenshot_failed, stack, description, tags, posted_at, is_published, updated_at, media')
    .eq('is_published', true);

  if (worksError) console.error('works query failed:', worksError.message);

  const worksByStudent = new Map<string, WorkRow[]>();
  for (const w of (worksData ?? []) as WorkRow[]) {
    const items = worksByStudent.get(w.student_id) ?? [];
    items.push(w);
    worksByStudent.set(w.student_id, items);
  }

  const me = await getCurrentStudent().catch(() => null);
  const myId = me?.id ?? null;

  const items: DirItem[] = list.map((s) => ({
    id: s.id,
    slug: studentSlug(s),
    name: s.display_name,
    city: s.city,
    country: s.country,
    region: resolveRegion(s.city, s.country),
    niche: s.niche,
    sphere: s.sphere,
    bio: s.bio,
    goal: s.goal,
    status: s.status,
    telegram: s.telegram_username,
    avatarUrl: s.avatar_url,
    workCount: worksByStudent.get(s.id)?.length ?? 0,
  }));

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

  return <Directory items={items} myId={myId} recommendations={recommendations} />;
}
