import { supabase, studentSlug, tbl, type StudentRow } from '@/lib/db';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { resolveRegion } from '@/lib/region';
import Directory, { type DirItem } from './directory';

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
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
  const me = await getCurrentStudent().catch(() => null);
  const myId = me?.id ?? null;

  let recCount = 0;
  if (myId) {
    const { count } = await serviceClient()
      .from(tbl('recommendations'))
      .select('recommended_id', { count: 'exact', head: true })
      .eq('student_id', myId);
    recCount = count ?? 0;
  }

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
    avatarColor: avatarColor(s.id),
    avatarUrl: s.avatar_url,
  }));

  return <Directory items={items} myId={myId} recCount={recCount} />;
}

const AVATAR_PALETTE = ['#E85A2A', '#2A6BE8', '#2D8F5E', '#7C3AED', '#CA8A04'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}
