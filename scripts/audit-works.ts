#!/usr/bin/env tsx
/**
 * Аудит опубликованных работ: снимает с публикации мёртвые и не-работы.
 *
 *   npm run audit:works          — записать в БД
 *   npm run audit:works -- --dry — показать план без записи
 *
 * Мёртвая работа: live_url отвечает не-2xx/сетевой ошибкой ЛИБО отдаёт 200
 * с маркером SPA-заглушки («page not found» и т.п. — lovable и hosting-SPA
 * отвечают 200 даже для убитых проектов). Не-работа: live_url попал под
 * актуальные правила isNotAWorkUrl (стоп-хосты дополняются со временем,
 * а старые импорты этого не знают).
 *
 * Только снимает с публикации (is_published=false), ничего не удаляет:
 * ожившую работу можно вернуть руками или повторным импортом.
 */
import 'dotenv/config';
import { getServiceClient, tbl, type Work } from '@vibe/db';
import { isNotAWorkUrl } from '@vibe/parser';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

const DEAD_MARKERS = [
  'page not found',
  'project not found',
  'not found</title>',
  'this site can’t be reached',
];

type Verdict = 'alive' | 'dead' | 'not-a-work';

async function checkUrl(url: string): Promise<{ verdict: Verdict; detail: string }> {
  if (isNotAWorkUrl(url)) return { verdict: 'not-a-work', detail: 'стоп-правила URL' };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    const resp = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vibe-audit)' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok) return { verdict: 'dead', detail: `HTTP ${resp.status}` };
    const body = (await resp.text()).slice(0, 30_000).toLowerCase();
    const marker = DEAD_MARKERS.find((m) => body.includes(m));
    if (marker) return { verdict: 'dead', detail: `200, но «${marker}»` };
    return { verdict: 'alive', detail: `HTTP ${resp.status}` };
  } catch (e) {
    return { verdict: 'dead', detail: e instanceof Error ? e.name : String(e) };
  }
}

async function main(): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db
    .from(tbl('works'))
    .select('id, title, live_url, is_published')
    .eq('is_published', true);
  if (error) throw error;

  const works = (data ?? []) as Pick<Work, 'id' | 'title' | 'live_url' | 'is_published'>[];
  const toHide: { id: string; title: string; reason: string }[] = [];

  for (const w of works) {
    if (!w.live_url) continue; // работы без сайта (бот, таблица) живости не требуют
    const { verdict, detail } = await checkUrl(w.live_url);
    const mark = verdict === 'alive' ? 'ok  ' : 'HIDE';
    console.log(`[${mark}] ${verdict.padEnd(10)} ${detail.padEnd(22)} ${w.title} — ${w.live_url}`);
    if (verdict !== 'alive') toHide.push({ id: w.id, title: w.title, reason: `${verdict}: ${detail}` });
  }

  console.log(`\nснять с публикации: ${toHide.length} из ${works.length}`);
  if (DRY || toHide.length === 0) return;

  const { error: updError } = await db
    .from(tbl('works'))
    .update({ is_published: false })
    .in('id', toHide.map((w) => w.id));
  if (updError) throw updError;
  console.log('готово.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
