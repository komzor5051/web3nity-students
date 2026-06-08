/**
 * Аватар-на-входе: при логине подтягиваем фото профиля из Telegram, если у
 * студента ещё нет аватара. Массовый бэкфилл невозможен (нет user_id у
 * импортированных карточек), поэтому аватар появляется в момент, когда мы
 * впервые получаем user_id — то есть при входе через бота.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { tbl, bucket, type Student } from '@web3nity/db';

/** Размер фото профиля в ответе getUserProfilePhotos. */
interface PhotoSize {
  file_id: string;
}
interface UserProfilePhotos {
  total_count: number;
  photos: PhotoSize[][];
}

/** Минимум возможностей telegram-клиента, который нужен для аватара. */
export interface AvatarCtx {
  telegram: {
    getUserProfilePhotos(userId: number, offset: number, limit: number): Promise<UserProfilePhotos>;
    getFileLink(fileId: string): Promise<URL>;
  };
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Из ответа getUserProfilePhotos берём file_id самого крупного размера первого
 * (самого свежего) фото. null — если фото нет.
 */
export function pickLargestPhotoFileId(photos: UserProfilePhotos): string | null {
  const first = photos.photos?.[0];
  if (!first || first.length === 0) return null;
  return first[first.length - 1]?.file_id ?? null;
}

/**
 * Если у студента нет аватара — скачивает фото профиля из Telegram и заливает в
 * бакет аватаров, проставляя avatar_url. Тихо выходит на любой осечке: вызов
 * fire-and-forget из bot.start, логин блокировать нельзя.
 */
export async function ensureAvatar(
  ctx: AvatarCtx,
  db: SupabaseClient,
  student: Student,
): Promise<void> {
  if (student.avatar_url) return; // не затираем загруженное руками
  if (!student.telegram_user_id) return;

  const photos = await ctx.telegram.getUserProfilePhotos(student.telegram_user_id, 0, 1);
  const fileId = pickLargestPhotoFileId(photos);
  if (!fileId) return;

  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.toString());
  if (!res.ok) return;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > AVATAR_MAX_BYTES) return;

  const key = `${student.id}/tg-${Date.now()}.jpg`;
  const up = await db.storage
    .from(bucket('students-avatars'))
    .upload(key, buf, { contentType: 'image/jpeg', upsert: true });
  if (up.error) return;

  const url = db.storage.from(bucket('students-avatars')).getPublicUrl(key).data.publicUrl;
  await db.from(tbl('students')).update({ avatar_url: url }).eq('id', student.id);
}
