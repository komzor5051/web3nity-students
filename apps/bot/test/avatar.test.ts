import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Student } from '@web3nity/db';
import { pickLargestPhotoFileId, ensureAvatar, type AvatarCtx } from '../src/avatar.js';

function student(over: Partial<Student> = {}): Student {
  return {
    id: 'stud-1',
    telegram_user_id: 42,
    telegram_username: 'alice',
    display_name: 'Alice',
    avatar_url: null,
    city: null,
    country: null,
    niche: null,
    sphere: null,
    bio: null,
    goal: null,
    expertise: null,
    hobbies: null,
    age: null,
    status: null,
    is_published: true,
    cohort: 'AI-Ассистенты 3.0',
    source_message_id: null,
    import_key: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('pickLargestPhotoFileId', () => {
  it('берёт самый крупный размер первого фото (последний в массиве)', () => {
    const photos = {
      total_count: 1,
      photos: [[{ file_id: 's' }, { file_id: 'm' }, { file_id: 'l' }]],
    };
    expect(pickLargestPhotoFileId(photos)).toBe('l');
  });

  it('null, когда фото нет', () => {
    expect(pickLargestPhotoFileId({ total_count: 0, photos: [] })).toBeNull();
  });

  it('null, когда первый набор пуст', () => {
    expect(pickLargestPhotoFileId({ total_count: 1, photos: [[]] })).toBeNull();
  });
});

/** Мок storage + таблицы: фиксирует upload/update вызовы. */
function makeDb() {
  const calls = { upload: [] as unknown[], update: [] as unknown[] };
  const db = {
    storage: {
      from() {
        return {
          upload(key: string, buf: Buffer, opts: unknown) {
            calls.upload.push({ key, size: buf.byteLength, opts });
            return Promise.resolve({ error: null });
          },
          getPublicUrl(key: string) {
            return { data: { publicUrl: `https://cdn/${key}` } };
          },
        };
      },
    },
    from() {
      return {
        update(patch: unknown) {
          return {
            eq(col: string, val: unknown) {
              calls.update.push({ patch, col, val });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

function makeCtx(over: Partial<{ photos: unknown; fileLink: string }> = {}): {
  ctx: AvatarCtx;
  spies: { getUserProfilePhotos: ReturnType<typeof vi.fn>; getFileLink: ReturnType<typeof vi.fn> };
} {
  const getUserProfilePhotos = vi.fn().mockResolvedValue(
    over.photos ?? { total_count: 1, photos: [[{ file_id: 's' }, { file_id: 'l' }]] },
  );
  const getFileLink = vi.fn().mockResolvedValue(new URL(over.fileLink ?? 'https://tg/file.jpg'));
  const ctx = { telegram: { getUserProfilePhotos, getFileLink } } as unknown as AvatarCtx;
  return { ctx, spies: { getUserProfilePhotos, getFileLink } };
}

describe('ensureAvatar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('скачивает фото и проставляет avatar_url, когда его нет', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer) }),
    );
    const { ctx, spies } = makeCtx();
    const { db, calls } = makeDb();

    await ensureAvatar(ctx, db, student());

    expect(spies.getUserProfilePhotos).toHaveBeenCalledWith(42, 0, 1);
    expect(spies.getFileLink).toHaveBeenCalledWith('l');
    expect(calls.upload).toHaveLength(1);
    expect(calls.update).toHaveLength(1);
    expect((calls.update[0] as { patch: { avatar_url: string } }).patch.avatar_url).toContain('https://cdn/stud-1/');
  });

  it('не трогает уже заполненный avatar_url', async () => {
    const { ctx, spies } = makeCtx();
    const { db, calls } = makeDb();

    await ensureAvatar(ctx, db, student({ avatar_url: 'https://cdn/existing.jpg' }));

    expect(spies.getUserProfilePhotos).not.toHaveBeenCalled();
    expect(calls.upload).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
  });

  it('пропускает, когда нет telegram_user_id', async () => {
    const { ctx, spies } = makeCtx();
    const { db, calls } = makeDb();

    await ensureAvatar(ctx, db, student({ telegram_user_id: null }));

    expect(spies.getUserProfilePhotos).not.toHaveBeenCalled();
    expect(calls.update).toHaveLength(0);
  });

  it('пропускает, когда у пользователя нет фото профиля', async () => {
    const { ctx, spies } = makeCtx({ photos: { total_count: 0, photos: [] } });
    const { db, calls } = makeDb();

    await ensureAvatar(ctx, db, student());

    expect(spies.getUserProfilePhotos).toHaveBeenCalledOnce();
    expect(spies.getFileLink).not.toHaveBeenCalled();
    expect(calls.upload).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
  });
});
