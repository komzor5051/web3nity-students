import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studentSlug } from './db';
import { fakeDb } from './fake-db';

// queries.ts ходит в базу через serviceClient из ./auth; подменяем его.
let db = fakeDb({});
vi.mock('./auth', () => ({ serviceClient: () => db }));

import { findProject, findStudentBySlug, publishedStudents, visibleProjects } from './queries';

const base = { is_published: true, source_message_id: 'tg:1:1' };
const WORK_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  db = fakeDb({
    students: [
      // Один ник на двух курсах: у человека две анкеты.
      { ...base, id: 's-vibe', course: 'vibecoding', telegram_username: 'ivan', display_name: 'Иван (вайб)', telegram_user_id: 1 },
      { ...base, id: 's-asst', course: 'assistants', telegram_username: 'ivan', display_name: 'Иван (ассистенты)', telegram_user_id: 1 },
      { ...base, id: 's-only-asst', course: 'assistants', telegram_username: null, display_name: 'Мария Орлова', telegram_user_id: null },
    ],
    members: [
      { telegram_user_id: 1, course: 'vibecoding', revoked: false },
      { telegram_user_id: 1, course: 'assistants', revoked: false },
    ],
    works: [
      { id: WORK_ID, student_id: 's-vibe', title: 'Бот записи', is_published: true, hidden_by_admin: false, posted_at: null, media: [], screenshot_path: null },
      { id: '22222222-2222-2222-2222-222222222222', student_id: 's-asst', title: 'Ассистент', is_published: true, hidden_by_admin: false, posted_at: null, media: [], screenshot_path: null },
    ],
  });
});

describe('findStudentBySlug', () => {
  it('один slug на двух курсах отдаёт анкету своего курса', async () => {
    expect((await findStudentBySlug('vibecoding', 'ivan'))?.id).toBe('s-vibe');
    expect((await findStudentBySlug('assistants', 'ivan'))?.id).toBe('s-asst');
  });

  it('slug без telegram_username (транслит + id) ищется только в своём курсе', async () => {
    const slug = studentSlug({ telegram_username: null, display_name: 'Мария Орлова', id: 's-only-asst' });
    expect((await findStudentBySlug('assistants', slug))?.id).toBe('s-only-asst');
    expect(await findStudentBySlug('vibecoding', slug)).toBeNull();
  });
});

describe('publishedStudents / visibleProjects', () => {
  it('каталог курса не содержит учеников и проектов другого курса', async () => {
    const vibe = await publishedStudents('vibecoding');
    expect(vibe.map((s) => s.id)).toEqual(['s-vibe']);
    const asst = await publishedStudents('assistants');
    expect(asst.map((s) => s.id).sort()).toEqual(['s-asst', 's-only-asst']);

    expect((await visibleProjects('vibecoding')).map((p) => p.title)).toEqual(['Бот записи']);
    expect((await visibleProjects('assistants')).map((p) => p.title)).toEqual(['Ассистент']);
  });

  it('участник только одного курса не попадает в каталог второго без импортной анкеты', async () => {
    db = fakeDb({
      students: [{ id: 'x', course: 'assistants', is_published: true, source_message_id: null, telegram_user_id: 5, display_name: 'X' }],
      members: [{ telegram_user_id: 5, course: 'vibecoding', revoked: false }],
      works: [],
    });
    expect(await publishedStudents('assistants')).toEqual([]);
  });
});

describe('findProject', () => {
  it('работа открывается только в курсе автора, в другом курсе — null (404)', async () => {
    expect((await findProject(WORK_ID, 'vibecoding'))?.work.title).toBe('Бот записи');
    expect(await findProject(WORK_ID, 'assistants')).toBeNull();
  });

  it('невалидный id не ходит в базу', async () => {
    expect(await findProject('not-a-uuid', 'vibecoding')).toBeNull();
  });
});
