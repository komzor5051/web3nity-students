#!/usr/bin/env tsx
/**
 * Батч-классификация участников по широким сферам.
 *
 *   npm run spheres          — записать в БД
 *   npm run spheres -- --dry — показать результат без записи
 *
 * Один прогон LLM: выбирает 5-7 сфер из реальных данных и присваивает
 * каждому участнику одну. Сайт фильтрует витрину по полю students.sphere.
 * Запускать вручную раз в месяц (как и recommend).
 */

import 'dotenv/config';
import { getServiceClient, tbl, type Student } from '@web3nity/db';
import { classifySpheres, type SphereInput } from '@web3nity/parser';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

type ProfileRow = Pick<
  Student,
  'id' | 'display_name' | 'niche' | 'bio' | 'expertise' | 'goal'
>;

async function main(): Promise<void> {
  const db = getServiceClient();

  const { data, error } = await db
    .from(tbl('students'))
    .select('id, display_name, niche, bio, expertise, goal')
    .eq('is_published', true);
  if (error) throw error;
  const students = (data ?? []) as ProfileRow[];
  console.log(`[spheres] участников: ${students.length}`);
  if (students.length < 5) {
    console.log('[spheres] слишком мало участников.');
    return;
  }

  const byIdx = new Map<number, ProfileRow>();
  const input: SphereInput[] = students.map((s, idx) => {
    byIdx.set(idx, s);
    return {
      idx,
      name: s.display_name,
      niche: s.niche ?? undefined,
      bio: s.bio ?? undefined,
      expertise: s.expertise ?? undefined,
      goal: s.goal ?? undefined,
    };
  });

  console.log('[spheres] запрос к LLM...');
  const { spheres, assignments } = await classifySpheres(input);

  console.log(`[spheres] сферы (${spheres.length}): ${spheres.join(', ')}`);
  console.log(`[spheres] присвоено: ${assignments.length} из ${students.length}`);

  // idx → uuid, группируем по сфере для пакетного апдейта.
  const idsBySphere = new Map<string, string[]>();
  for (const a of assignments) {
    const student = byIdx.get(a.idx);
    if (!student) continue;
    const arr = idsBySphere.get(a.sphere) ?? [];
    arr.push(student.id);
    idsBySphere.set(a.sphere, arr);
  }

  if (DRY) {
    for (const [sphere, ids] of idsBySphere) {
      console.log(`  ${sphere}: ${ids.length} чел.`);
    }
    console.log('\n[spheres] --dry: в БД не записано.');
    return;
  }

  for (const [sphere, ids] of idsBySphere) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error: upErr } = await db
        .from(tbl('students'))
        .update({ sphere })
        .in('id', chunk);
      if (upErr) throw upErr;
    }
  }
  console.log(`[spheres] готово — обновлено ${assignments.length} профилей.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
