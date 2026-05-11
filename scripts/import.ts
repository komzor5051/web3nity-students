#!/usr/bin/env tsx
/**
 * One-shot import: Telegram HTML export → Supabase.
 *
 * Usage:
 *   npm run import:dry -- --export-dir /path/to/ChatExport_2026-05-08
 *   npm run import     -- --export-dir /path/to/ChatExport_2026-05-08
 *
 * Idempotent:
 *   - raw_messages keyed by `html:<message_id>` — UPSERT.
 *   - students keyed by (cohort, import_key) — UPSERT, не перетирает поля,
 *     которые студент отредактировал через бот (updated_at > intro.posted_at).
 *   - works keyed by source_message_id — UPSERT, is_published остаётся как был.
 */

import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseExportDir,
  groupConsecutive,
  isLongPost,
  normalizeAuthorKey,
  classifyPosts,
  type GroupedPost,
  type ClassifiedPost,
  type ParsedMessage,
} from '@web3nity/parser';
import { getServiceClient, tbl, type Student, type MediaItem } from '@web3nity/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadFromExport } from './storage.js';

interface Args {
  exportDir: string;
  dryRun: boolean;
  cohort: string;
  limitPosts?: number;
  /** Если задан — не пишем в Supabase, а дампим payload-ы students/works в JSON. */
  outFile?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--export-dir') args.exportDir = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--cohort') args.cohort = argv[++i];
    else if (a === '--limit') args.limitPosts = parseInt(argv[++i] ?? '0', 10);
    else if (a === '--out') args.outFile = argv[++i];
  }
  if (!args.exportDir) {
    console.error('--export-dir is required');
    process.exit(1);
  }
  args.cohort ??= process.env.COHORT ?? 'AI-Ассистенты 3.0';
  return args as Args;
}

interface StudentPayload {
  display_name: string;
  cohort: string;
  import_key: string;
  source_message_id: string;
  city: string | null;
  country: string | null;
  niche: string | null;
  bio: string | null;
  goal: string | null;
  expertise: string | null;
  hobbies: string | null;
  age: number | null;
  status: Student['status'];
  is_published: boolean;
}

interface WorkPayload {
  import_key: string; // для связывания со студентом на стороне вставки
  title: string;
  description: string | null;
  tags: string[];
  source_message_id: string;
  posted_at: string | null;
  is_published: boolean;
}

/** Собирает payload-ы из результатов классификации, без записи в БД. */
function buildPayloads(
  posts: GroupedPost[],
  classified: ClassifiedPost[],
  cohort: string,
): { students: StudentPayload[]; works: WorkPayload[] } {
  const introsByAuthor = pickIntros(posts, classified);
  const studentByKey = new Map<string, StudentPayload>();

  for (const [authorName, { post, intro }] of introsByAuthor) {
    const key = normalizeAuthorKey(authorName);
    studentByKey.set(key, {
      display_name: intro.name?.trim() || authorName,
      cohort,
      import_key: key,
      source_message_id: `html:${post.rootMessageId}`,
      city: intro.city ?? null,
      country: intro.country ?? null,
      niche: intro.niche ?? null,
      bio: intro.bio ?? null,
      goal: intro.goal ?? null,
      expertise: intro.expertise ?? null,
      hobbies: intro.hobbies ?? null,
      age: intro.age ?? null,
      status: intro.status ?? null,
      is_published: true,
    });
  }

  const works: WorkPayload[] = [];
  for (let i = 0; i < posts.length; i++) {
    if (classified[i]!.classified_as !== 'work') continue;
    const post = posts[i]!;
    const cls = classified[i]!;
    const key = normalizeAuthorKey(post.authorName);
    if (!studentByKey.has(key)) {
      // Студент без intro — создаём заглушку профиля.
      studentByKey.set(key, {
        display_name: post.authorName,
        cohort,
        import_key: key,
        source_message_id: `html:${post.rootMessageId}`,
        city: null, country: null, niche: null, bio: null, goal: null,
        expertise: null, hobbies: null, age: null, status: null,
        is_published: true,
      });
    }
    works.push({
      import_key: key,
      title: cls.work?.title?.trim() || post.text.split('\n')[0]!.slice(0, 100) || 'Без названия',
      description: cls.work?.description ?? post.text.slice(0, 1000),
      tags: cls.work?.tags ?? [],
      source_message_id: `html:${post.rootMessageId}`,
      posted_at: post.postedAt,
      is_published: false,
    });
  }

  return { students: [...studentByKey.values()], works };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[import] dir=${args.exportDir}  dry-run=${args.dryRun}  cohort="${args.cohort}"`);

  // 1. Parse HTML.
  const messages = await parseExportDir(args.exportDir);
  console.log(`[parse] ${messages.length} messages, ${countAuthors(messages)} authors`);

  const writeToDb = !args.dryRun && !args.outFile;

  // 2. Insert into raw_messages (idempotent UPSERT).
  const db = writeToDb ? getServiceClient() : null;
  if (db) await upsertRawMessages(db, messages);

  // 3. Group consecutive same-author messages into logical posts.
  const groups = groupConsecutive(messages);
  const longPosts = groups.filter((g) => isLongPost(g));
  console.log(`[group] ${groups.length} groups, ${longPosts.length} long posts`);

  // 4. LLM classify long posts.
  const limited = args.limitPosts ? longPosts.slice(0, args.limitPosts) : longPosts;
  console.log(`[llm] classifying ${limited.length} posts...`);
  const classified = await classifyPosts(limited, {
    onBatch: (done, total) => process.stdout.write(`\r[llm] ${done}/${total}`),
  });
  process.stdout.write('\n');

  // 4b. JSON-dump режим (для вставки через внешний канал, минуя service_role).
  if (args.outFile) {
    const payloads = buildPayloads(limited, classified, args.cohort);
    await writeFile(args.outFile, JSON.stringify(payloads, null, 2), 'utf8');
    console.log(`[out] ${payloads.students.length} students, ${payloads.works.length} works → ${args.outFile}`);
    return;
  }

  // 5. Build students from intros (latest non-empty wins per author).
  const introsByAuthor = pickIntros(limited, classified);
  console.log(`[upsert] ${introsByAuthor.size} student profiles candidate`);

  // 6. Upsert students.
  const studentIdByKey = new Map<string, string>();
  for (const [authorName, { post, intro }] of introsByAuthor) {
    const key = normalizeAuthorKey(authorName);
    if (args.dryRun) {
      studentIdByKey.set(key, `dry-${key}`);
      console.log(
        `[dry] student "${intro.name ?? authorName}" niche=${intro.niche ?? '-'} city=${intro.city ?? '-'}`,
      );
    } else {
      const id = await upsertStudent(db!, args.cohort, authorName, key, post, intro);
      studentIdByKey.set(key, id);
    }
  }

  // 7. Upsert works (only for known students).
  const works = limited.filter((g, i) => classified[i]!.classified_as === 'work');
  let workCount = 0;
  for (let i = 0; i < limited.length; i++) {
    if (classified[i]!.classified_as !== 'work') continue;
    const post = limited[i]!;
    const cls = classified[i]!;
    const key = normalizeAuthorKey(post.authorName);
    const studentId = studentIdByKey.get(key);
    if (!studentId) {
      // У студента нет intro в выгрузке — создаём минимальный профиль на лету.
      if (args.dryRun) {
        console.log(`[dry] would create stub student for "${post.authorName}"`);
        continue;
      }
      const id = await upsertStudent(db!, args.cohort, post.authorName, key, post, {});
      studentIdByKey.set(key, id);
    }
    if (args.dryRun) {
      console.log(`[dry] work "${cls.work?.title ?? post.text.slice(0, 40)}" by ${post.authorName}`);
      workCount++;
      continue;
    }
    await upsertWork(db!, args.exportDir, studentIdByKey.get(key)!, post, cls);
    workCount++;
  }
  console.log(`[done] students=${studentIdByKey.size} works=${workCount} dry-run=${args.dryRun}`);
}

function countAuthors(messages: ParsedMessage[]): number {
  const set = new Set<string>();
  for (const m of messages) if (m.authorName) set.add(m.authorName);
  return set.size;
}

async function upsertRawMessages(db: SupabaseClient, messages: ParsedMessage[]) {
  const rows = messages
    .filter((m) => !m.isService)
    .map((m) => ({
      id: `html:${m.messageId}`,
      thread_id: m.threadId,
      author_tg_id: null,
      author_name: m.authorName,
      text: m.text || null,
      media: m.media.length ? m.media : null,
      posted_at: m.postedAt,
      classified_as: null,
      processed_at: null,
      ingested_from: 'html_export' as const,
    }));
  // Chunk to avoid request size limits.
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from(tbl('raw_messages')).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
  console.log(`[upsert] raw_messages: ${rows.length} rows`);
}

interface IntroPick {
  post: GroupedPost;
  intro: NonNullable<ClassifiedPost['intro']>;
}

function pickIntros(posts: GroupedPost[], classified: ClassifiedPost[]): Map<string, IntroPick> {
  // Берём наиболее "полное" intro на автора (счётчик заполненных полей).
  const map = new Map<string, IntroPick>();
  for (let i = 0; i < posts.length; i++) {
    const cls = classified[i]!;
    if (cls.classified_as !== 'intro' || !cls.intro) continue;
    const post = posts[i]!;
    const score = Object.values(cls.intro).filter((v) => v !== undefined && v !== '').length;
    const existing = map.get(post.authorName);
    if (!existing) {
      map.set(post.authorName, { post, intro: cls.intro });
      continue;
    }
    const existingScore = Object.values(existing.intro).filter((v) => v !== undefined && v !== '').length;
    if (score > existingScore) map.set(post.authorName, { post, intro: cls.intro });
  }
  return map;
}

async function upsertStudent(
  db: SupabaseClient,
  cohort: string,
  authorName: string,
  importKey: string,
  post: GroupedPost,
  intro: ClassifiedPost['intro'] = {},
): Promise<string> {
  const { data: existing } = await db
    .from(tbl('students'))
    .select('id, updated_at, source_message_id')
    .eq('cohort', cohort)
    .eq('import_key', importKey)
    .maybeSingle();

  const display = intro?.name?.trim() || authorName;
  const payload: Partial<Student> = {
    display_name: display,
    cohort,
    import_key: importKey,
    source_message_id: `html:${post.rootMessageId}`,
    city: intro?.city ?? null,
    country: intro?.country ?? null,
    niche: intro?.niche ?? null,
    bio: intro?.bio ?? null,
    goal: intro?.goal ?? null,
    expertise: intro?.expertise ?? null,
    hobbies: intro?.hobbies ?? null,
    age: intro?.age ?? null,
    status: intro?.status ?? null,
    is_published: true,
  };

  if (existing) {
    // Если профиль был отредактирован студентом через бот (updated_at заметно
    // позже posted_at оригинального intro) — не перетираем поля.
    const editedByUser =
      post.postedAt && Date.parse(existing.updated_at) - Date.parse(post.postedAt) > 60_000;
    if (editedByUser) return existing.id;

    const { error } = await db.from(tbl('students')).update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await db
    .from(tbl('students'))
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data!.id;
}

async function upsertWork(
  db: SupabaseClient,
  exportDir: string,
  studentId: string,
  post: GroupedPost,
  cls: ClassifiedPost,
): Promise<void> {
  const sourceId = `html:${post.rootMessageId}`;
  const title = cls.work?.title?.trim() || post.text.split('\n')[0]!.slice(0, 100) || 'Без названия';

  // Загружаем медиа в Storage и собираем итоговый MediaItem[].
  const media: MediaItem[] = [];
  for (const m of post.media) {
    if (m.type !== 'image' && m.type !== 'video' && m.type !== 'file') continue;
    const url = await uploadFromExport(db, exportDir, m.path, studentId, sourceId);
    if (!url) continue;
    const itemType: MediaItem['type'] = m.type === 'file'
      ? (/\.pdf$/i.test(m.path) ? 'pdf' : 'link')
      : (m.type as 'image' | 'video');
    media.push({ type: itemType, url, caption: m.filename });
  }

  const payload = {
    student_id: studentId,
    title,
    description: cls.work?.description ?? post.text.slice(0, 1000),
    media,
    tags: cls.work?.tags ?? [],
    source_message_id: sourceId,
    posted_at: post.postedAt,
    is_published: false, // спека: импортированные работы по умолчанию скрыты
  };

  const { error } = await db
    .from(tbl('works'))
    .upsert(payload, { onConflict: 'source_message_id' });
  if (error) throw error;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
