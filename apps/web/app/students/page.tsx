import { supabase, studentSlug, tbl, type StudentRow } from '@/lib/db';
import { getCurrentStudent } from '@/lib/auth';
import Directory, { type DirItem } from './directory';

export const revalidate = 60;

export default async function StudentsPage() {
  const { data, error } = await supabase
    .from(tbl('students'))
    .select(
      'id,display_name,avatar_url,city,country,niche,bio,goal,status,telegram_username,import_key,updated_at',
    )
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) console.error('students query failed:', error.message);

  const list = (data ?? []) as StudentRow[];
  const me = await getCurrentStudent().catch(() => null);
  const myId = me?.id ?? null;

  const items: DirItem[] = list.map((s) => ({
    id: s.id,
    slug: studentSlug(s),
    name: s.display_name,
    city: s.city,
    country: s.country,
    region: regionOf(s.country),
    niche: s.niche,
    bio: s.bio,
    goal: s.goal,
    status: s.status,
    telegram: s.telegram_username,
    avatarColor: avatarColor(s.id),
    avatarUrl: s.avatar_url,
  }));

  return <Directory items={items} myId={myId} />;
}

const REGION_MAP: Record<string, string> = {
  'Россия': 'СНГ',
  'Беларусь': 'СНГ',
  'Украина': 'СНГ',
  'Казахстан': 'СНГ',
  'Узбекистан': 'СНГ',
  'Армения': 'СНГ',
  'Грузия': 'СНГ',
  'Молдавия': 'СНГ',
  'Молдова': 'СНГ',
  'Киргизия': 'СНГ',
  'Германия': 'Европа',
  'Испания': 'Европа',
  'Франция': 'Европа',
  'Италия': 'Европа',
  'Польша': 'Европа',
  'Чехия': 'Европа',
  'Нидерланды': 'Европа',
  'Португалия': 'Европа',
  'ОАЭ': 'Ближний Восток',
  'Израиль': 'Ближний Восток',
  'Турция': 'Ближний Восток',
  'Китай': 'Азия',
  'Тайланд': 'Азия',
  'Вьетнам': 'Азия',
  'Индонезия': 'Азия',
  'США': 'Америка',
  'Канада': 'Америка',
  'Мексика': 'Америка',
  'Бразилия': 'Америка',
  'Аргентина': 'Америка',
};

function regionOf(country: string | null): string | null {
  if (!country) return null;
  return REGION_MAP[country] ?? null;
}

const AVATAR_PALETTE = ['#E85A2A', '#2A6BE8', '#2D8F5E', '#7C3AED', '#CA8A04'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}
