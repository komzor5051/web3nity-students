#!/usr/bin/env tsx
/**
 * Список учеников для доступа к платформе + привязка анкет к Telegram ID.
 *
 *   npm run members            — записать в БД
 *   npm run members -- --dry   — показать план без записи
 *
 * Вход: data/members.json (scripts/dump_members.py) и data/dump.json
 * (scripts/dump_telegram.py).
 *
 * 1. Участники чатов курса -> vibe_members (upsert, ручные записи и revoked
 *    организатора не трогаем).
 * 2. Анкеты без telegram_user_id получают постоянный ID автора исходного
 *    сообщения #обомне (source_message_id = tg:<chat>:<message>). Если такой
 *    анкеты нет — по точному @username среди участников. Спорные случаи
 *    (один ID на две анкеты, ник у двух людей) не склеиваем, а печатаем.
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { getServiceClient, tbl } from '@vibe/db';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

type Member = { telegram_user_id: number; username: string | null; display_name: string | null; chats: number[] };
type DumpMsg = { message_id: number; author_id: number | null };
type Dump = { chats: { chat_id: number; messages: DumpMsg[] }[] };

const members = (JSON.parse(readFileSync('data/members.json', 'utf8')) as { members: Member[] }).members;
const dump = JSON.parse(readFileSync('data/dump.json', 'utf8')) as Dump;

const authorBySource = new Map<string, number>();
for (const chat of dump.chats) {
  for (const m of chat.messages) {
    if (m.author_id) authorBySource.set(`tg:${chat.chat_id}:${m.message_id}`, m.author_id);
  }
}

async function main() {
  const db = getServiceClient();

  // 1. Участники.
  const { data: existing } = await db.from(tbl('members')).select('telegram_user_id, source');
  const manual = new Set((existing ?? []).filter((r) => r.source !== 'chat').map((r) => Number(r.telegram_user_id)));
  const rows = members
    .filter((m) => !manual.has(m.telegram_user_id))
    .map((m) => ({
      telegram_user_id: m.telegram_user_id,
      username: m.username,
      display_name: m.display_name,
      chats: m.chats,
      source: 'chat',
    }));
  console.log(`members: ${rows.length} из чатов (ручных пропущено: ${manual.size})`);
  if (!DRY) {
    const { error } = await db.from(tbl('members')).upsert(rows, { onConflict: 'telegram_user_id', ignoreDuplicates: false });
    if (error) throw error;
  }

  // 2. Привязка анкет.
  const { data: students, error } = await db
    .from(tbl('students'))
    .select('id, display_name, telegram_user_id, telegram_username, source_message_id');
  if (error) throw error;
  const list = students ?? [];
  const taken = new Set(list.filter((s) => s.telegram_user_id).map((s) => Number(s.telegram_user_id)));

  const plan = new Map<string, number>();
  const byUsername = new Map<string, Member[]>();
  for (const m of members) {
    if (!m.username) continue;
    const k = m.username.toLowerCase();
    byUsername.set(k, [...(byUsername.get(k) ?? []), m]);
  }

  for (const s of list) {
    if (s.telegram_user_id) continue;
    let id = s.source_message_id ? authorBySource.get(s.source_message_id) : undefined;
    if (!id && s.telegram_username) {
      const hits = byUsername.get(s.telegram_username.replace(/^@/, '').toLowerCase()) ?? [];
      if (hits.length === 1) id = hits[0]!.telegram_user_id;
    }
    if (id) plan.set(s.id, id);
  }

  // Один ID на несколько анкет или уже занятый ID — спорно, не трогаем.
  const counts = new Map<number, number>();
  for (const id of plan.values()) counts.set(id, (counts.get(id) ?? 0) + 1);
  const disputed: string[] = [];
  for (const [sid, id] of plan) {
    if ((counts.get(id) ?? 0) > 1 || taken.has(id)) {
      disputed.push(`${list.find((s) => s.id === sid)?.display_name} -> ${id}`);
      plan.delete(sid);
    }
  }

  const unlinked = list.filter((s) => !s.telegram_user_id && !plan.has(s.id));
  console.log(`анкет к привязке: ${plan.size}; спорных: ${disputed.length}; без ID останется: ${unlinked.length}`);
  for (const d of disputed) console.log('  спорно:', d);
  for (const s of unlinked) console.log('  без ID:', s.display_name);

  if (DRY) return;
  for (const [sid, id] of plan) {
    const { error: e } = await db.from(tbl('students')).update({ telegram_user_id: id }).eq('id', sid).is('telegram_user_id', null);
    if (e) console.error('  ошибка', sid, e.message);
  }
  console.log('готово');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
