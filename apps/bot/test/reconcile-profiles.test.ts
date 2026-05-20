import { describe, it, expect } from 'vitest';
import { parseMessageId, introPatch } from '../src/reconcile-profiles.js';

describe('parseMessageId', () => {
  it('извлекает message_id из bot_pull id', () => {
    expect(parseMessageId('tg:-1001234567:890')).toBe(890);
  });

  it('работает с отрицательным chat id и без него', () => {
    expect(parseMessageId('tg:42:7')).toBe(7);
  });

  it('возвращает null для мусора', () => {
    expect(parseMessageId('tg:chat:abc')).toBeNull();
    expect(parseMessageId('')).toBeNull();
  });
});

describe('introPatch', () => {
  it('переносит только непустые поля', () => {
    const patch = introPatch({ city: 'Новосибирск', niche: '', bio: 'AI-разработчик' });
    expect(patch).toEqual({ city: 'Новосибирск', bio: 'AI-разработчик' });
  });

  it('переносит age и status', () => {
    const patch = introPatch({ age: 28, status: 'looking_for_clients' });
    expect(patch.age).toBe(28);
    expect(patch.status).toBe('looking_for_clients');
  });

  it('пустой intro → пустой патч', () => {
    expect(introPatch({})).toEqual({});
  });
});
