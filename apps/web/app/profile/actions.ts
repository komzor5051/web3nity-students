'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { tbl } from '@/lib/db';
import { uploadAvatar, uploadWorkMedia, type MediaItem } from '@/lib/storage';

const STATUSES = ['looking_for_clients', 'looking_for_partners', 'just_learning'];

export type ActionResult = { ok: true } | { ok: false; error: string };

function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Сохранить поля профиля. */
export async function updateProfile(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return { ok: false, error: 'Сессия истекла — войдите заново.' };

  const ageRaw = form.get('age');
  const age =
    typeof ageRaw === 'string' && ageRaw.trim() ? Math.floor(Number(ageRaw)) : null;
  const statusRaw = form.get('status');
  const status =
    typeof statusRaw === 'string' && STATUSES.includes(statusRaw) ? statusRaw : null;

  const patch = {
    display_name: text(form, 'display_name') ?? me.display_name,
    niche: text(form, 'niche'),
    city: text(form, 'city'),
    country: text(form, 'country'),
    bio: text(form, 'bio'),
    goal: text(form, 'goal'),
    expertise: text(form, 'expertise'),
    hobbies: text(form, 'hobbies'),
    age: age && age > 10 && age < 100 ? age : null,
    status,
    is_published: form.get('is_published') === 'on',
  };

  const { error } = await serviceClient().from(tbl('students')).update(patch).eq('id', me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  return { ok: true };
}

/** Загрузить / поменять аватар профиля. */
export async function updateAvatar(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return { ok: false, error: 'Сессия истекла — войдите заново.' };

  const file = form.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Выберите файл с фото.' };
  }
  const url = await uploadAvatar(me.id, file);
  if (!url) return { ok: false, error: 'Не удалось загрузить фото (только JPG/PNG/WebP до 5 МБ).' };

  const { error } = await serviceClient()
    .from(tbl('students'))
    .update({ avatar_url: url })
    .eq('id', me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  revalidatePath('/students');
  return { ok: true };
}

/** Добавить работу с загрузкой файлов. */
export async function createWork(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return { ok: false, error: 'Сессия истекла — войдите заново.' };

  const title = text(form, 'title');
  if (!title) return { ok: false, error: 'Укажите название проекта.' };

  const description = text(form, 'description');
  const tags = (text(form, 'tags') ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length < 40)
    .slice(0, 8);

  const files = form
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0);
  const media: MediaItem[] = [];
  for (const f of files.slice(0, 10)) {
    const item = await uploadWorkMedia(me.id, f);
    if (item) media.push(item);
  }

  const { error } = await serviceClient().from(tbl('works')).insert({
    student_id: me.id,
    title,
    description,
    tags,
    media,
    is_published: true,
    posted_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/profile');
  return { ok: true };
}

/** Удалить работу (только свою). */
export async function deleteWork(form: FormData): Promise<void> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return;
  const workId = form.get('workId');
  if (typeof workId !== 'string') return;
  await serviceClient()
    .from(tbl('works'))
    .delete()
    .eq('id', workId)
    .eq('student_id', me.id);
  revalidatePath('/profile');
}

/** Показать / скрыть работу на витрине (только свою). */
export async function toggleWork(form: FormData): Promise<void> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return;
  const workId = form.get('workId');
  const next = form.get('next') === 'true';
  if (typeof workId !== 'string') return;
  await serviceClient()
    .from(tbl('works'))
    .update({ is_published: next })
    .eq('id', workId)
    .eq('student_id', me.id);
  revalidatePath('/profile');
}
