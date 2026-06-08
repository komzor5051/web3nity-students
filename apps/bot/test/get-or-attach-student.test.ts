import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrAttachStudent, type TgUser } from '../src/students.js';

/**
 * Лёгкий мок Supabase-клиента. Каждый вызов db.from(...) собирает цепочку
 * операторов и фильтров, а терминальный await (then) резолвится тем, что
 * вернёт переданный handler(op), где op = { kind, eq, is, ilike, update, insert }.
 *
 * kind: 'select' | 'update' | 'insert'
 * Терминаторы: maybeSingle / single -> { data } ; иначе then -> { data, error }.
 */
interface QueryOp {
  kind: 'select' | 'update' | 'insert';
  eq: Record<string, unknown>;
  is: Record<string, unknown>;
  ilike: Record<string, unknown>;
  update?: Record<string, unknown>;
  insert?: Record<string, unknown>;
  terminal?: 'maybeSingle' | 'single';
}

type Handler = (op: QueryOp) => { data?: unknown; error?: unknown };

function makeDb(handler: Handler): { db: SupabaseClient; ops: QueryOp[] } {
  const ops: QueryOp[] = [];

  function builder(op: QueryOp) {
    const chain: Record<string, unknown> = {
      select() {
        return chain;
      },
      eq(col: string, val: unknown) {
        op.eq[col] = val;
        return chain;
      },
      is(col: string, val: unknown) {
        op.is[col] = val;
        return chain;
      },
      ilike(col: string, val: unknown) {
        op.ilike[col] = val;
        return chain;
      },
      maybeSingle() {
        op.terminal = 'maybeSingle';
        const r = handler(op);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
      },
      single() {
        op.terminal = 'single';
        const r = handler(op);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
      },
      // терминал-через-await на самом query builder (для .ilike(...) без single)
      then(resolve: (v: unknown) => unknown) {
        const r = handler(op);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null }).then(resolve);
      },
    };
    return chain;
  }

  const db = {
    from() {
      return {
        select() {
          const op: QueryOp = { kind: 'select', eq: {}, is: {}, ilike: {} };
          ops.push(op);
          return builder(op);
        },
        update(patch: Record<string, unknown>) {
          const op: QueryOp = { kind: 'update', eq: {}, is: {}, ilike: {}, update: patch };
          ops.push(op);
          return builder(op);
        },
        insert(row: Record<string, unknown>) {
          const op: QueryOp = { kind: 'insert', eq: {}, is: {}, ilike: {}, insert: row };
          ops.push(op);
          return builder(op);
        },
      };
    },
  } as unknown as SupabaseClient;

  return { db, ops };
}

const user: TgUser = { id: 42, username: 'Alice', first_name: 'Не', last_name: 'Совпадает' };

describe('getOrAttachStudent', () => {
  it('(а) привязывает по username к непривязанному профилю и пишет telegram_user_id', async () => {
    const handler: Handler = (op) => {
      if (op.kind === 'select' && 'telegram_user_id' in op.eq) {
        // шаг 1: поиск по tg_id — не найден
        return { data: null };
      }
      if (op.kind === 'select' && 'telegram_username' in op.ilike) {
        // шаг 2: ровно одно непривязанное совпадение по username
        return { data: [{ id: 'stud-1', telegram_user_id: null, telegram_username: 'Alice' }] };
      }
      if (op.kind === 'update') {
        return { data: { id: 'stud-1', telegram_user_id: 42, telegram_username: 'Alice' } };
      }
      throw new Error('unexpected op: ' + JSON.stringify(op));
    };
    const { db, ops } = makeDb(handler);

    const result = await getOrAttachStudent(db, user);

    expect(result.id).toBe('stud-1');
    expect(result.telegram_user_id).toBe(42);

    // username сравнивается в нижнем регистре
    const usernameSelect = ops.find((o) => 'telegram_username' in o.ilike)!;
    expect(usernameSelect.ilike.telegram_username).toBe('alice');
    expect(usernameSelect.is.telegram_user_id).toBeNull();

    // апдейт проставил telegram_user_id
    const update = ops.find((o) => o.kind === 'update')!;
    expect(update.update).toMatchObject({ telegram_user_id: 42, telegram_username: 'Alice' });
    expect(update.eq.id).toBe('stud-1');
  });

  it('(б) пропускает username-матч при 2+ непривязанных совпадениях (неоднозначно) и падает в insert', async () => {
    const handler: Handler = (op) => {
      if (op.kind === 'select' && 'telegram_user_id' in op.eq) return { data: null };
      if (op.kind === 'select' && 'telegram_username' in op.ilike) {
        // два точных совпадения — неоднозначно
        return {
          data: [
            { id: 'a', telegram_user_id: null, telegram_username: 'Alice' },
            { id: 'b', telegram_user_id: null, telegram_username: 'alice' },
          ],
        };
      }
      if (op.kind === 'select' && 'import_key' in op.eq) return { data: null };
      if (op.kind === 'insert') return { data: { id: 'new-1', telegram_user_id: 42 } };
      throw new Error('unexpected op: ' + JSON.stringify(op));
    };
    const { db, ops } = makeDb(handler);

    const result = await getOrAttachStudent(db, user);

    expect(result.id).toBe('new-1');
    // апдейта быть не должно — привязка пропущена
    expect(ops.some((o) => o.kind === 'update')).toBe(false);
    expect(ops.some((o) => o.kind === 'insert')).toBe(true);
  });

  it('(в) приоритет telegram_user_id над username', async () => {
    const handler: Handler = (op) => {
      if (op.kind === 'select' && 'telegram_user_id' in op.eq) {
        return { data: { id: 'existing', telegram_user_id: 42 } };
      }
      throw new Error('не должно дойти до username-матчинга');
    };
    const { db, ops } = makeDb(handler);

    const result = await getOrAttachStudent(db, user);

    expect(result.id).toBe('existing');
    // username-селекта не было
    expect(ops.some((o) => 'telegram_username' in o.ilike)).toBe(false);
  });

  it('(д) ilike-over-match по "_" отсекается точным сравнением и падает в insert', async () => {
    // username с подчёркиванием: ilike трактует '_' как wildcard и может вернуть
    // чужой профиль ('fooXbar'). Точное сравнение должно его отсеять → insert.
    const underscoreUser: TgUser = { id: 7, username: 'foo_bar', first_name: 'Ноу', last_name: 'Нейм' };
    const insertSpy = vi.fn();
    const handler: Handler = (op) => {
      if (op.kind === 'select' && 'telegram_user_id' in op.eq) return { data: null };
      if (op.kind === 'select' && 'telegram_username' in op.ilike) {
        return { data: [{ id: 'wrong', telegram_user_id: null, telegram_username: 'fooXbar' }] };
      }
      if (op.kind === 'select' && 'import_key' in op.eq) return { data: null };
      if (op.kind === 'insert') {
        insertSpy(op.insert);
        return { data: { id: 'fresh', telegram_user_id: 7, is_published: false } };
      }
      throw new Error('unexpected op: ' + JSON.stringify(op));
    };
    const { db, ops } = makeDb(handler);

    const result = await getOrAttachStudent(db, underscoreUser);

    expect(result.id).toBe('fresh');
    expect(ops.some((o) => o.kind === 'update')).toBe(false);
    expect(insertSpy).toHaveBeenCalledOnce();
  });

  it('(г) падает в создание нового, когда ни id, ни username, ни имя не совпали', async () => {
    const insertSpy = vi.fn();
    const handler: Handler = (op) => {
      if (op.kind === 'select' && 'telegram_user_id' in op.eq) return { data: null };
      if (op.kind === 'select' && 'telegram_username' in op.ilike) return { data: [] };
      if (op.kind === 'select' && 'import_key' in op.eq) return { data: null };
      if (op.kind === 'insert') {
        insertSpy(op.insert);
        return { data: { id: 'fresh', telegram_user_id: 42, is_published: false } };
      }
      throw new Error('unexpected op: ' + JSON.stringify(op));
    };
    const { db } = makeDb(handler);

    const result = await getOrAttachStudent(db, user);

    expect(result.id).toBe('fresh');
    expect(insertSpy).toHaveBeenCalledOnce();
    expect(insertSpy.mock.calls[0]![0]).toMatchObject({
      telegram_user_id: 42,
      is_published: true, // профиль виден по умолчанию
    });
  });
});
