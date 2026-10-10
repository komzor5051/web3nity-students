'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentStudent, serviceClient } from '@/lib/auth';
import { tbl, type StudentStatus, type WorkKind, type WorkStage } from '@/lib/db';
import { REGIONS, STATUS_ORDER } from '@/lib/catalog';
import { uploadAvatar, uploadWorkMedia } from '@/lib/storage';
import { validateHttpUrl } from '@/lib/urls';

export type ActionResult = { ok: true } | { ok: false; error: string } | null;

// Потолок длины любого текстового поля: прямой запрос к server action
// обходит лимиты формы.
const MAX_TEXT = 4000;
const KINDS: WorkKind[] = ['site', 'bot', 'crm', 'other'];
const STAGES: WorkStage[] = ['in_progress', 'done'];

function text(form: FormData, key: string, max = MAX_TEXT): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function file(form: FormData, key: string): File | null {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

const SESSION_GONE: ActionResult = { ok: false, error: 'Сессия истекла. Войдите заново и повторите.' };

function touch(paths: string[]) {
  for (const p of ['/', '/students', '/projects', '/profile', ...paths]) revalidatePath(p);
}

/** Создать или обновить свою анкету. Пишет только в запись текущего ученика. */
export async function saveProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return SESSION_GONE;

  const name = text(form, 'display_name', 120);
  if (!name) return { ok: false, error: 'Укажите, как вас зовут.' };

  const statuses = form
    .getAll('statuses')
    .filter((x): x is StudentStatus => typeof x === 'string' && STATUS_ORDER.includes(x as StudentStatus));
  const region = text(form, 'region');

  const patch: Record<string, unknown> = {
    display_name: name,
    city: text(form, 'city', 120),
    country: text(form, 'country', 120),
    region: region && REGIONS.includes(region) ? region : null,
    sphere: text(form, 'sphere', 80),
    niche: text(form, 'niche', 300),
    bio: text(form, 'bio'),
    expectations: text(form, 'expectations'),
    goal: text(form, 'goal'),
    statuses,
    status: statuses[0] ?? null,
    // telegram_username не редактируется: он приходит из Telegram при входе,
    // по нему строится адрес профиля, и чужой ник вписать нельзя.
    is_published: true,
    // Отметка «правил сам»: импорт больше не перезаписывает анкету.
    self_edited_at: new Date().toISOString(),
  };

  const photo = file(form, 'photo');
  if (photo) {
    const url = await uploadAvatar(me.id, photo);
    if (!url) return { ok: false, error: 'Фото не загрузилось: подойдут JPG, PNG или WebP до 5 МБ.' };
    patch.avatar_url = url;
  }

  const { error } = await serviceClient().from(tbl('students')).update(patch).eq('id', me.id);
  if (error) return { ok: false, error: 'Не удалось сохранить анкету. Попробуйте ещё раз.' };
  touch(['/profile/edit']);
  redirect('/profile?saved=profile');
}

/** Добавить проект или обновить свой. Автор — всегда текущий ученик. */
export async function saveProject(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return SESSION_GONE;

  const id = text(form, 'id', 64);
  const title = text(form, 'title', 160);
  const description = text(form, 'description');
  if (!title) return { ok: false, error: 'Укажите название проекта.' };
  if (!description) return { ok: false, error: 'Опишите, какую задачу решает проект и для кого.' };

  const kindRaw = text(form, 'kind');
  const stageRaw = text(form, 'stage');
  const live = validateHttpUrl(text(form, 'live_url', 500), 'Ссылка на проект');
  if (!live.ok) return { ok: false, error: live.error };

  const patch: Record<string, unknown> = {
    title,
    description,
    kind: KINDS.includes(kindRaw as WorkKind) ? kindRaw : null,
    stage: STAGES.includes(stageRaw as WorkStage) ? stageRaw : 'in_progress',
    live_url: live.value,
    features: text(form, 'features'),
    feedback_request: text(form, 'feedback_request'),
  };

  const cover = file(form, 'cover');
  if (cover) {
    if (!cover.type.startsWith('image/')) return { ok: false, error: 'Обложка: подойдёт картинка JPG, PNG или WebP.' };
    const item = await uploadWorkMedia(me.id, cover);
    if (!item) return { ok: false, error: 'Обложка не загрузилась: картинка до 15 МБ.' };
    patch.media = [item];
    // Своя обложка важнее автоматического скриншота сайта.
    patch.screenshot_path = null;
  }

  const svc = serviceClient();
  let workId = id;
  if (id) {
    const { data, error } = await svc
      .from(tbl('works'))
      .update(patch)
      .eq('id', id)
      .eq('student_id', me.id)
      .select('id')
      .maybeSingle();
    if (error || !data) return { ok: false, error: 'Не удалось сохранить проект. Попробуйте ещё раз.' };
  } else {
    const { data, error } = await svc
      .from(tbl('works'))
      .insert({
        ...patch,
        student_id: me.id,
        media: patch.media ?? [],
        tags: [],
        is_published: true,
        posted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: 'Не удалось опубликовать проект. Попробуйте ещё раз.' };
    workId = data.id as string;
  }
  touch([`/w/${workId}`]);
  redirect(`/w/${workId}`);
}

/** Скрыть / снова показать свой проект. */
export async function toggleProject(form: FormData): Promise<void> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return;
  const id = form.get('id');
  if (typeof id !== 'string') return;
  await serviceClient()
    .from(tbl('works'))
    .update({ is_published: form.get('next') === 'true' })
    .eq('id', id)
    .eq('student_id', me.id);
  touch([`/w/${id}`]);
}

/** Удалить свой проект. */
export async function deleteProject(form: FormData): Promise<void> {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) return;
  const id = form.get('id');
  if (typeof id !== 'string') return;
  await serviceClient().from(tbl('works')).delete().eq('id', id).eq('student_id', me.id);
  touch([]);
}
