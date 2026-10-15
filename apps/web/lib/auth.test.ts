import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb } from './fake-db';

let db = fakeDb({});
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }));
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';

import { getMember, isMember, memberCourses } from './auth';

beforeEach(() => {
  db = fakeDb({
    members: [
      { telegram_user_id: 1, course: 'vibecoding', revoked: false, username: 'ivan', display_name: 'Иван' },
      { telegram_user_id: 1, course: 'assistants', revoked: false, username: 'ivan', display_name: 'Иван' },
      { telegram_user_id: 2, course: 'assistants', revoked: false, username: null, display_name: null },
      { telegram_user_id: 3, course: 'vibecoding', revoked: true, username: null, display_name: null },
      { telegram_user_id: 3, course: 'assistants', revoked: false, username: null, display_name: null },
    ],
  });
});

describe('участники нескольких курсов', () => {
  it('человек с двумя записями не ломает проверку членства (раньше maybeSingle падал бы)', async () => {
    expect(await isMember(1, 'vibecoding')).toBe(true);
    expect(await isMember(1, 'assistants')).toBe(true);
    expect((await getMember(1, 'assistants'))?.username).toBe('ivan');
  });

  it('членство считается по курсу', async () => {
    expect(await isMember(2, 'assistants')).toBe(true);
    expect(await isMember(2, 'vibecoding')).toBe(false);
  });

  it('закрытый доступ в одном курсе не закрывает другой', async () => {
    expect(await isMember(3, 'vibecoding')).toBe(false);
    expect(await isMember(3, 'assistants')).toBe(true);
  });

  it('memberCourses: все не закрытые курсы в порядке реестра', async () => {
    expect(await memberCourses(1)).toEqual(['vibecoding', 'assistants']);
    expect(await memberCourses(2)).toEqual(['assistants']);
    expect(await memberCourses(3)).toEqual(['assistants']);
    expect(await memberCourses(99)).toEqual([]);
  });
});
