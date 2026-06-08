#!/usr/bin/env tsx
/**
 * Батч-доразметка статуса участникам, у которых он пуст.
 *
 *   npm run enrich:status            — записать в БД
 *   npm run enrich:status -- --dry   — показать план без записи
 *
 * Идемпотентно и безопасно: трогает только строки со status IS NULL, у которых
 * есть текстовый сигнал (bio/goal/expertise). Существующие статусы НЕ
 * перезаписываются. Модель консервативна — кого не уверена, того пропускает.
 */

import 'dotenv/config';
import { getServiceClient, tbl, type Student } from '@web3nity/db';
import { inferStatuses, type StatusInput } from '@web3nity/parser';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

type Row = Pick<
  Student,
  'id' | 'display_name' | 'niche' | 'bio' | 'goal' | 'expertise' | 'hobbies' | 'status' | 'is_published'
>;

function hasSignal(s: Row): boolean {
  return Boolean((s.bio ?? '').trim() || (s.goal ?? '').trim() || (s.expertise ?? '').trim());
}

async function main(): Promise<void> {
  const db = getServiceClient();

  const { data, error } = await db
    .from(tbl('students'))
    .select('id, display_name, niche, bio, goal, expertise, hobbies, status, is_published')
    .is('status', null);
  if (error) throw error;

  const candidates = ((data ?? []) as Row[]).filter((s) => s.is_published && hasSignal(s));
  console.log(
    `[enrich-status] без статуса с сигналом: ${candidates.length} (всего null: ${(data ?? []).length})`,
  );
  if (candidates.length === 0) {
    console.log('[enrich-status] нечего размечать.');
    return;
  }

  const byIdx = new Map<number, Row>();
  const inputs: StatusInput[] = candidates.map((s, idx) => {
    byIdx.set(idx, s);
    return {
      idx,
      name: s.display_name,
      niche: s.niche ?? undefined,
      bio: s.bio ?? undefined,
      goal: s.goal ?? undefined,
      expertise: s.expertise ?? undefined,
      hobbies: s.hobbies ?? undefined,
    };
  });

  console.log('[enrich-status] запрос к LLM...');
  const result = await inferStatuses(inputs, {
    onBatch: (done, total) => process.stdout.write(`\r[enrich-status] ${done}/${total}`),
  });
  process.stdout.write('\n');

  const updates = result
    .map((r) => ({ row: byIdx.get(r.idx), status: r.status }))
    .filter((u): u is { row: Row; status: typeof u.status } => Boolean(u.row));
  console.log(`[enrich-status] размечено ${updates.length} из ${candidates.length}`);

  if (DRY) {
    for (const u of updates) console.log(`  ${u.row.display_name} → ${u.status}`);
    console.log('\n[enrich-status] --dry: в БД не записано.');
    return;
  }

  let written = 0;
  for (const u of updates) {
    // status IS NULL в условии — защита от гонки/повторного перезаписывания.
    const { error: upErr } = await db
      .from(tbl('students'))
      .update({ status: u.status })
      .eq('id', u.row.id)
      .is('status', null);
    if (upErr) throw upErr;
    written++;
  }
  console.log(`[enrich-status] готово — обновлено ${written} строк.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
