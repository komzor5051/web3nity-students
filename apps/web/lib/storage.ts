import { serviceClient } from './auth';

/** Публичный бакет для медиа работ (см. packages/db bucket('works-media')). */
const BUCKET = 'web3nity-works-media';
const MAX_BYTES = 15 * 1024 * 1024;

export type MediaItem = {
  type: 'image' | 'video' | 'pdf' | 'link';
  url: string;
  caption?: string;
};

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm'];

function mediaType(ext: string): MediaItem['type'] {
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXT.includes(ext)) return 'image';
  return 'link';
}

/** Безопасный объектный ключ без кириллицы и пробелов. */
function safeKey(studentId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  const base = fileName
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 60);
  return `${studentId}/web/${Date.now()}-${base}${ext ? '.' + ext : ''}`;
}

/**
 * Загружает файл работы в Supabase Storage и возвращает MediaItem.
 * null — файл пустой, слишком большой или загрузка не удалась (не валим форму).
 */
export async function uploadWorkMedia(
  studentId: string,
  file: File,
): Promise<MediaItem | null> {
  if (file.size === 0 || file.size > MAX_BYTES) return null;

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const key = safeKey(studentId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const svc = serviceClient();
  const { error } = await svc.storage.from(BUCKET).upload(key, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    console.warn('[storage] upload failed:', error.message);
    return null;
  }

  const { data } = svc.storage.from(BUCKET).getPublicUrl(key);
  return { type: mediaType(ext), url: data.publicUrl, caption: file.name };
}
