#!/usr/bin/env tsx
/**
 * Батч-генерация рекомендаций знакомств.
 *
 * Запускается ВРУЧНУЮ раз в месяц (или после крупного обновления профилей):
 *   npm run recommend            — записать в БД
 *   npm run recommend -- --dry   — показать план без записи
 *
 * Один прогон LLM по всему списку участников. Сайт потом только читает
 * таблицу recommendations — на просмотре страниц токены не тратятся.
 *
 * Идемпотентно: таблица recommendations полностью перезаписывается.
 */

import 'dotenv/config';
import { getServiceClient, tbl, type Student } from '@web3nity/db';
import { recommendConnections, type RosterEntry } from '@web3nity/parser';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

type ProfileRow = Pick<
  Student,
  | 'id'
  | 'display_name'
  | 'niche'
  | 'city'
  | 'country'
  | 'bio'
  | 'goal'
  | 'expertise'
  | 'hobbies'
  | 'status'
  | 'is_published'
>;

function toRosterEntry(s: ProfileRow, idx: number): RosterEntry {
  return {
    idx,
    name: s.display_name,
    niche: s.niche ?? undefined,
    city: s.city ?? undefined,
    country: s.country ?? undefined,
    bio: s.bio ?? undefined,
    goal: s.goal ?? undefined,
    expertise: s.expertise ?? undefined,
    hobbies: s.hobbies ?? undefined,
    status: s.status ?? undefined,
  };
}

async function main(): Promise<void> {
  const db = getServiceClient();

  // 1. Все участники. Рекомендации генерируем для каждого (в т.ч. ещё не
  //    опубликованных — чтобы новый вошедший сразу видел подборку), а
  //    рекомендуем только опубликованных (их видно на витрине).
  const { data, error } = await db
    .from(tbl('students'))
    .select(
      'id, display_name, niche, city, country, bio, goal, expertise, hobbies, status, is_published',
    );
  if (error) throw error;
  const students = (data ?? []) as ProfileRow[];
  const published = students.filter((s) => s.is_published);
  console.log(`[recommend] участников: ${students.length} (опубликовано: ${published.length})`);
  if (published.length < 3) {
    console.log('[recommend] слишком мало опубликованных профилей — нечего рекомендовать.');
    return;
  }

  // 2. Единое idx-пространство для всех участников (LLM оперирует индексами).
  const byIdx = new Map<number, ProfileRow>();
  students.forEach((s, idx) => byIdx.set(idx, s));

  const roster: RosterEntry[] = [];
  const targets: RosterEntry[] = [];
  students.forEach((s, idx) => {
    const entry = toRosterEntry(s, idx);
    targets.push(entry);
    if (s.is_published) roster.push(entry);
  });

  // 3. LLM.
  console.log('[recommend] запрос к LLM...');
  const result = await recommendConnections(roster, targets, {
    onBatch: (done, total) => process.stdout.write(`\r[recommend] ${done}/${total}`),
  });
  process.stdout.write('\n');

  // 4. idx → UUID, строки для вставки.
  const rows: { student_id: string; recommended_id: string; reason: string; rank: number }[] = [];
  for (const r of result) {
    const student = byIdx.get(r.idx);
    if (!student) continue;
    r.recs.forEach((rec, rank) => {
      const target = byIdx.get(rec.recommended_idx);
      if (!target) return;
      rows.push({
        student_id: student.id,
        recommended_id: target.id,
        reason: rec.reason,
        rank,
      });
    });
  }
  console.log(`[recommend] подобрано ${rows.length} рекомендаций для ${result.length} участников`);

  if (DRY) {
    for (const r of result.slice(0, 5)) {
      const s = byIdx.get(r.idx)!;
      console.log(`\n${s.display_name}:`);
      for (const rec of r.recs) {
        console.log(`  → ${byIdx.get(rec.recommended_idx)?.display_name}: ${rec.reason}`);
      }
    }
    console.log('\n[recommend] --dry: в БД не записано.');
    return;
  }

  // 5. Полная перезапись таблицы.
  const del = await db.from(tbl('recommendations')).delete().gte('rank', 0);
  if (del.error) throw del.error;

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error: insErr } = await db.from(tbl('recommendations')).insert(chunk);
    if (insErr) throw insErr;
  }
  console.log(`[recommend] готово — записано ${rows.length} строк.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
