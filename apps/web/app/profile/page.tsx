import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { studentSlug, tbl, type WorkRow } from '@/lib/db';
import AvatarUploader from './avatar-uploader';
import ProfileEditor from './profile-editor';
import WorksSection from './works-section';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) redirect('/login');

  const { data: worksData } = await serviceClient()
    .from(tbl('works'))
    .select('*')
    .eq('student_id', me.id)
    .order('updated_at', { ascending: false });
  const works = (worksData ?? []) as WorkRow[];

  const slug = studentSlug(me);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-start gap-4">
        <AvatarUploader name={me.display_name} url={me.avatar_url} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl">{me.display_name}</h1>
          <div className="text-text2 text-sm">
            {[me.niche, me.city || me.country].filter(Boolean).join(' · ') || 'Профиль курса AI-Ассистенты 3.0'}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            {me.is_published ? (
              <Link
                href={`/students/${slug}`}
                className="text-xs px-3 py-1 rounded-full border border-line hover:border-accent hover:text-accent"
              >
                Открыть публичную страницу
              </Link>
            ) : (
              <span className="text-xs text-text3">
                Профиль скрыт — включите публикацию ниже, чтобы открылась публичная страница.
              </span>
            )}
          </div>
        </div>
      </div>

      <ProfileEditor student={me} />
      <WorksSection works={works} />
    </div>
  );
}
