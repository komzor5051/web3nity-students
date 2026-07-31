import { describe, it, expect } from 'vitest';
import { studentSlug } from './db';

describe('studentSlug', () => {
  it('uses telegram_username when present', () => {
    expect(
      studentSlug({ telegram_username: 'IvanPetrov', display_name: 'Иван Петров', id: 'a' }),
    ).toBe('ivanpetrov');
  });

  it('falls back to a transliterated, suffixed slug without telegram_username', () => {
    const slug = studentSlug({
      telegram_username: null,
      display_name: 'Иван Петров',
      id: '11111111-2222-3333-4444-555555555555',
    });
    expect(slug).toBe('ivan-petrov-111111');
  });

  it('produces distinct slugs for two students with the same name (collision)', () => {
    const a = studentSlug({
      telegram_username: null,
      display_name: 'Иван Петров',
      id: '11111111-2222-3333-4444-555555555555',
    });
    const b = studentSlug({
      telegram_username: null,
      display_name: 'Иван Петров',
      id: '99999999-8888-7777-6666-555555555555',
    });
    expect(a).not.toBe(b);
  });

  it('produces distinct slugs for the same student appearing twice (two tariffs)', () => {
    // Тот же id -> тот же slug, но два РАЗНЫХ id с одинаковым именем
    // (например, дубль записи одного ученика на двух тарифах) не должны
    // схлопнуться в один и тот же slug.
    const nameless = studentSlug({
      telegram_username: null,
      display_name: '',
      id: '11111111-2222-3333-4444-555555555555',
    });
    const nameless2 = studentSlug({
      telegram_username: null,
      display_name: '',
      id: '22222222-3333-4444-5555-666666666666',
    });
    expect(nameless).not.toBe(nameless2);
  });
});
