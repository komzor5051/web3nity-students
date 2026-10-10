/**
 * Справочники и приведение строк базы к виду карточек. Без обращений к базе,
 * поэтому годится и серверу, и клиентским каталогам.
 */
import { studentSlug, type StudentRow, type StudentStatus, type WorkKind, type WorkRow, type WorkStage } from './db';
import { resolveRegion } from './region';
import { canonicalSphere, cleanBio, tgHandle } from './text';

export const STATUS_LABEL: Record<StudentStatus, string> = {
  just_learning: 'Просто учусь',
  looking_for_partners: 'Ищу партнёра',
  looking_for_clients: 'Ищу клиентов',
};
export const STATUS_ORDER: StudentStatus[] = ['just_learning', 'looking_for_partners', 'looking_for_clients'];

export const KIND_LABEL: Record<WorkKind, string> = {
  site: 'Сайт',
  bot: 'AI-бот',
  crm: 'Мини-CRM',
  other: 'Другое',
};
export const KIND_ORDER: WorkKind[] = ['site', 'bot', 'crm', 'other'];

export const STAGE_LABEL: Record<WorkStage, string> = {
  in_progress: 'В работе',
  done: 'Готов',
};

/** Полный набор сфер прототипа + все, что уже есть в базе (см. sphereOptions). */
export const BASE_SPHERES = [
  'Маркетинг', 'IT', 'Образование', 'Недвижимость', 'Здоровье',
  'Производство и строительство', 'Торговля и e-commerce', 'Финансы',
  'Юриспруденция', 'Туризм', 'Красота', 'Культура', 'Медиа',
  'Услуги и сервис', 'Дизайн',
];

export const REGIONS = ['СНГ', 'Европа', 'Ближний Восток', 'Азия', 'Америка', 'Африка', 'Океания'];

/** Пустое значение фильтра «Не указано». */
export const NONE = '__none__';

export type StudentCardData = {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  region: string | null;
  sphere: string | null;
  niche: string | null;
  about: string | null;
  statuses: StudentStatus[];
  telegram: string | null;
  updatedAt: string;
};

export type ProjectCardData = {
  id: string;
  title: string;
  description: string | null;
  kind: WorkKind | null;
  stage: WorkStage | null;
  liveUrl: string | null;
  repoUrl: string | null;
  imageUrl: string | null;
  authorName: string;
  authorSlug: string;
  postedAt: string | null;
  hidden: boolean;
};

export function studentStatuses(s: Pick<StudentRow, 'statuses' | 'status'>): StudentStatus[] {
  const list = s.statuses?.length ? s.statuses : s.status ? [s.status] : [];
  return STATUS_ORDER.filter((x) => list.includes(x));
}

export function studentLocation(s: Pick<StudentRow, 'city' | 'country'>): string | null {
  const parts = [s.city, s.country].map((x) => x?.trim()).filter(Boolean);
  return parts.length ? [...new Set(parts)].join(', ') : null;
}

export function studentRegion(s: Pick<StudentRow, 'region' | 'city' | 'country'>): string | null {
  return s.region ?? resolveRegion(s.city, s.country);
}

export function toStudentCard(s: StudentRow): StudentCardData {
  return {
    id: s.id,
    slug: studentSlug(s),
    name: s.display_name,
    avatarUrl: s.avatar_url,
    location: studentLocation(s),
    region: studentRegion(s),
    sphere: canonicalSphere(s.sphere),
    niche: s.niche?.trim() || null,
    about: cleanBio(s.bio),
    statuses: studentStatuses(s),
    telegram: tgHandle(s.telegram_username),
    updatedAt: s.updated_at,
  };
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const BUCKET_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_PREFIX ?? '';

/** Обложка проекта: скриншот сайта или первая загруженная картинка. */
export function projectImageUrl(w: Pick<WorkRow, 'screenshot_path' | 'media'>): string | null {
  if (w.screenshot_path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_PREFIX}works-media/${w.screenshot_path}`;
  }
  return (w.media ?? []).find((m) => m.type === 'image')?.url ?? null;
}

export function toProjectCard(w: WorkRow, author: Pick<StudentRow, 'display_name' | 'telegram_username' | 'id'>): ProjectCardData {
  return {
    id: w.id,
    title: w.title,
    description: cleanBio(w.description),
    kind: w.kind,
    stage: w.stage,
    liveUrl: w.live_url,
    repoUrl: w.repo_url,
    imageUrl: projectImageUrl(w),
    authorName: author.display_name,
    authorSlug: studentSlug(author),
    postedAt: w.posted_at,
    hidden: w.hidden_by_admin || !w.is_published,
  };
}

/** Заполненные анкеты выше пустых, внутри — свежие выше. */
export function byCompleteness(a: StudentCardData, b: StudentCardData): number {
  const score = (x: StudentCardData) =>
    (x.about ? 2 : 0) + (x.niche ? 1 : 0) + (x.sphere ? 1 : 0) + (x.statuses.length ? 1 : 0) + (x.avatarUrl ? 1 : 0);
  return score(b) - score(a) || b.updatedAt.localeCompare(a.updatedAt);
}
