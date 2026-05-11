/**
 * Загружает локальный файл из Telegram-экспорта в Supabase Storage и
 * возвращает публичный URL. Идемпотентно: если объект уже есть — не
 * перезагружает, просто возвращает URL (upsert: true).
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bucket } from '@web3nity/db';

const BUCKET = bucket('works-media');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** Безопасный объектный ключ (без кириллицы / пробелов). */
function safeKey(studentId: string, sourceId: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const base = path
    .basename(filename, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  // sourceId уже включает префикс html: или tg: — заменим разделитель на _.
  const safeSource = sourceId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${studentId}/${safeSource}/${base}${ext || ''}`;
}

export async function uploadFromExport(
  db: SupabaseClient,
  exportDir: string,
  relativePath: string,
  studentId: string,
  sourceId: string,
): Promise<string | null> {
  const localPath = path.join(exportDir, relativePath);
  let size: number;
  try {
    size = (await stat(localPath)).size;
  } catch {
    return null; // файла нет — пропускаем без падения
  }
  if (size > 50 * 1024 * 1024) return null; // 50 MB cap

  const buf = await readFile(localPath);
  const key = safeKey(studentId, sourceId, relativePath);

  const { error } = await db.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: mimeFor(relativePath), upsert: true });
  if (error) {
    // Не валим весь импорт из-за одного файла (нет прав на бакет, сеть и т.п.).
    console.warn(`[storage] upload failed for ${relativePath}: ${error.message}`);
    return null;
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
