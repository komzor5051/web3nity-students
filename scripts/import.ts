#!/usr/bin/env tsx
/**
 * Импорт: JSON-дамп Telegram → Supabase.
 *
 *   npm run import:dry        # план без записи
 *   npm run import            # боевой прогон
 *
 * Идемпотентность:
 *   - raw_messages по `tg:<chat_id>:<message_id>` — UPSERT
 *   - students по (cohort, import_key) — UPSERT, не перетирает то,
 *     что ученик отредактировал сам (updated_at свежее поста > 60 c)
 *   - works по source_message_id — UPSERT, is_published не трогается
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  readDump,
  toParsedMessages,
  topicTitle,
  usernameByAuthorName,
  groupConsecutive,
  isLongPost,
  normalizeAuthorKey,
  ambiguousAuthorNames,
  authorKeyOf,
  classifyByTopic,
  cohortOf,
  extractUrls,
  extractIntros,
  extractWorks,
  isMeaningfulIntro,
  type IntroFields,
  type WorkFields,
  type ParsedMessage,
  type TopicKind,
  type FailedBatch,
} from '@vibe/parser';
import { getServiceClient, tbl } from '@vibe/db';

interface Args {
  dumpFile: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--dump-file') args.dumpFile = argv[++i];
  }
  args.dumpFile ??= process.env.DUMP_FILE ?? 'data/dump.json';
  return args as Args;
}

export interface StudentPayload {
  display_name: string;
  cohort: string;
  import_key: string;
  telegram_username: string | null;
  source_message_id: string;
  city: string | null;
  country: string | null;
  niche: string | null;
  bio: string | null;
  goal: string | null;
  expertise: string | null;
  hobbies: string | null;
  age: number | null;
  status: IntroFields['status'] | null;
  is_published: boolean;
}

export interface WorkPayload {
  import_key: string;
  cohort: string;
  title: string;
  description: string | null;
  live_url: string | null;
  repo_url: string | null;
  stack: string[];
  tags: string[];
  source_message_id: string;
  posted_at: string | null;
  is_published: boolean;
}

/** Пара «что писать» + «когда пост опубликован» — нужна mergeStudentFields для порога ручной правки. */
interface StudentRecord {
  payload: StudentPayload;
  postedAt: string | null;
}

interface RawRow {
  id: string;
  topic_id: number | null;
  author_name: string | null;
  text: string | null;
  posted_at: string | null;
  classified_as: 'intro' | 'work' | 'qa' | 'chat';
  ingested_from: 'telegram_live';
}

/** FailedBatch + откуда он взялся — иначе в сводке не понять, что чинить. */
interface FailureContext extends FailedBatch {
  chatId: number;
  kind: 'intro' | 'work';
}

export function buildStudentPayload(input: {
  chatId: number;
  authorName: string;
  authorUsername: string | null;
  rootMessageId: number;
  intro: IntroFields;
  /** Ключ профиля. По умолчанию — имя; у тёзок разведён по telegram user id. */
  importKey?: string;
}): StudentPayload {
  const { chatId, authorName, authorUsername, rootMessageId, intro, importKey } = input;
  return {
    display_name: intro.name?.trim() || authorName.trim(),
    cohort: cohortOf(chatId),
    import_key: importKey ?? normalizeAuthorKey(authorName),
    telegram_username: authorUsername,
    source_message_id: `tg:${chatId}:${rootMessageId}`,
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
  };
}

/**
 * Чей это VIP-топик. Ветка названа именем ученика, но пишут в неё и куратор,
 * и бывают тёзки — поэтому владельцем считаем самого активного автора,
 * пишущего под именем ветки. null, если под этим именем в ветке никто не писал.
 */
/**
 * Прогресс разбора. Без него прогон молчит десятки минут, и отличить работу
 * от зависания можно только по открытым сокетам процесса — так и было.
 */
function progress(label: string): (done: number, total: number) => void {
  return (done, total) => console.log(`[extract] ${label}: ${done}/${total}`);
}

export function resolveTopicOwnerId(
  messages: ParsedMessage[],
  topicTitleName: string,
): number | null {
  const wanted = normalizeAuthorKey(topicTitleName);
  const counts = new Map<number, number>();
  for (const m of messages) {
    if (m.authorId === null || !m.authorName) continue;
    if (normalizeAuthorKey(m.authorName) !== wanted) continue;
    counts.set(m.authorId, (counts.get(m.authorId) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/** Откуда пришла работа — определяет, публикуется она или остаётся черновиком. */
export type WorkSource = 'showcase' | 'vip_personal';

export function buildWorkPayload(input: {
  chatId: number;
  importKey: string;
  rootMessageId: number;
  postedAt: string | null;
  text: string;
  /** По умолчанию 'showcase' — публичная ветка, самый частый источник. */
  source?: WorkSource;
  work: WorkFields;
}): WorkPayload | null {
  const { chatId, importKey, rootMessageId, postedAt, text, source = 'showcase', work } = input;
  if (!work.isAnnouncement) return null;
  // Без заголовка карточку нечем подписать — такую работу не создаём.
  if (!work.title) return null;

  const urls = extractUrls(text);
  return {
    import_key: importKey,
    cohort: cohortOf(chatId),
    title: work.title,
    description: work.description ?? null,
    live_url: urls.liveUrl,
    repo_url: urls.repoUrl,
    stack: work.stack ?? [],
    tags: work.tags ?? [],
    source_message_id: `tg:${chatId}:${rootMessageId}`,
    posted_at: postedAt,
    // Ветка показа публична по замыслу организаторов — перенос на витрину
    // не раскрывает ничего нового. Личная переписка с куратором — раскрывает,
    // поэтому оттуда только черновики.
    is_published: source === 'showcase',
  };
}

/** Запас на расхождение часов и на задержку между постом и записью в БД. */
const MANUAL_EDIT_THRESHOLD_MS = 60_000;

/**
 * Какие поля профиля импорт вправе записать.
 *
 * Пусто, если ученик редактировал профиль сам: считаем правкой всё, что
 * произошло позже поста больше чем на порог. Также никогда не затираем
 * заполненное поле пустым значением из импорта.
 */
export function mergeStudentFields(
  payload: Record<string, unknown>,
  existing: ({ updated_at: string } & Record<string, unknown>) | null,
  postedAt: string | null,
): Record<string, unknown> {
  if (!existing) return { ...payload };

  if (postedAt) {
    const edited = Date.parse(existing.updated_at) - Date.parse(postedAt);
    if (Number.isFinite(edited) && edited > MANUAL_EDIT_THRESHOLD_MS) return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Нормализует live_url для сравнения на точное совпадение: без схемы, без
 * ведущего www, без завершающего слэша, хост в нижнем регистре. Путь и
 * query-параметры остаются как есть — они значимы (`/crm/requests` — не то
 * же самое, что корень сайта).
 */
export function normalizeLiveUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl.trim().toLowerCase();
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let path = parsed.pathname;
  if (path === '/') path = '';
  else if (path.endsWith('/')) path = path.slice(0, -1);
  return `${host}${path}${parsed.search}`;
}

/**
 * Схлопывает работы одного ученика с одинаковым (после нормализации)
 * live_url, оставляя запись с самой поздней posted_at — это апдейт той же
 * работы, а не два разных проекта.
 *
 * Намеренно НЕ схлопывает по домену второго уровня или платформе
 * (nihad-legal.lovable.app и nihad-legaldesk.lovable.app — разные работы
 * одного автора) и никогда не трогает работы без ссылки — там точное
 * совпадение просто не с чем сравнивать.
 */
export function dedupeWorksByLiveUrl(works: WorkPayload[]): WorkPayload[] {
  const withoutUrl: WorkPayload[] = [];
  const byKey = new Map<string, WorkPayload>();

  for (const work of works) {
    if (!work.live_url) {
      withoutUrl.push(work);
      continue;
    }
    const key = `${work.cohort}::${work.import_key}::${normalizeLiveUrl(work.live_url)}`;
    const existing = byKey.get(key);
    if (!existing || isNewerPost(work.posted_at, existing.posted_at)) {
      byKey.set(key, work);
    }
  }

  return [...withoutUrl, ...byKey.values()];
}

function isNewerPost(candidate: string | null, current: string | null): boolean {
  if (!candidate) return false;
  if (!current) return true;
  return Date.parse(candidate) > Date.parse(current);
}

async function run(args: Args): Promise<{ failures: FailureContext[] }> {
  const chats = await readDump(args.dumpFile);
  const students: StudentRecord[] = [];
  const works: WorkPayload[] = [];
  const rawRows: RawRow[] = [];
  const failures: FailureContext[] = [];

  for (const chat of chats) {
    const usernames = usernameByAuthorName(chat);
    const parsed = toParsedMessages(chat);

    const byKind = new Map<TopicKind, ParsedMessage[]>();
    for (const message of parsed) {
      const kind = classifyByTopic(chat.chatId, message.threadId);
      if (kind === 'ignore') continue;
      const list = byKind.get(kind) ?? [];
      list.push(message);
      byKind.set(kind, list);
    }

    // Всё, кроме игнорируемого, попадает в аудит. Публикуется только то,
    // что ниже превратится в students/works.
    for (const [kind, list] of byKind) {
      for (const m of list) {
        rawRows.push({
          id: `tg:${chat.chatId}:${m.messageId}`,
          topic_id: m.threadId,
          author_name: m.authorName,
          text: m.text,
          posted_at: m.postedAt,
          classified_as: (kind === 'vip_personal' ? 'chat' : kind) as RawRow['classified_as'],
          ingested_from: 'telegram_live',
        });
      }
    }

    // Тёзки: под одним именем в чате могут писать разные люди. Разводим их
    // ключи по telegram user id — иначе получится один профиль на двоих.
    const ambiguous = ambiguousAuthorNames(parsed);

    // Представления. Короткие реплики («Ок», «Спасибо») отсекаем ДО отправки
    // в Gemini — они не могут быть представлением, и это экономит запросы.
    const introPosts = groupConsecutive(byKind.get('intro') ?? []).filter((p) => isLongPost(p));
    const { results: intros, failedBatches: introFailures } = await extractIntros(introPosts, {
      onBatch: progress(`представления ${chat.title}`),
    });
    for (const f of introFailures) failures.push({ ...f, chatId: chat.chatId, kind: 'intro' });
    for (const post of introPosts) {
      const intro = intros.get(post.rootMessageId);
      // Второй фильтр — уже по содержимому: Gemini иногда возвращает intro
      // с одним лишь именем для короткой реплики. Одно имя — не профиль.
      if (!intro || !isMeaningfulIntro(intro)) continue;
      students.push({
        payload: buildStudentPayload({
          chatId: chat.chatId,
          authorName: post.authorName,
          authorUsername: usernames.get(post.authorName) ?? null,
          rootMessageId: post.rootMessageId,
          intro,
          importKey: authorKeyOf(post.authorName, post.authorId, ambiguous),
        }),
        postedAt: post.postedAt,
      });
    }

    // Работы из общей ветки. Тот же фильтр длины: реплика в три слова не
    // может быть анонсом работы.
    const workPosts = groupConsecutive(byKind.get('work') ?? []).filter((p) => isLongPost(p));
    const { results: extracted, failedBatches: workFailures } = await extractWorks(workPosts, {
      onBatch: progress(`работы ${chat.title}`),
    });
    for (const f of workFailures) failures.push({ ...f, chatId: chat.chatId, kind: 'work' });
    for (const post of workPosts) {
      const fields = extracted.get(post.rootMessageId);
      if (!fields) continue;
      const payload = buildWorkPayload({
        chatId: chat.chatId,
        importKey: authorKeyOf(post.authorName, post.authorId, ambiguous),
        rootMessageId: post.rootMessageId,
        postedAt: post.postedAt,
        text: post.text,
        source: 'showcase',
        work: fields,
      });
      if (payload) works.push(payload);
    }

    // VIP: ветка = ученик. Имя ветки даёт профиль, работы берём только из
    // сообщений самого ученика — реплики куратора работой быть не могут.
    const vip = byKind.get('vip_personal') ?? [];
    const byTopic = new Map<number, ParsedMessage[]>();
    for (const m of vip) {
      if (m.threadId === null) continue;
      const list = byTopic.get(m.threadId) ?? [];
      list.push(m);
      byTopic.set(m.threadId, list);
    }

    for (const [topicId, messages] of byTopic) {
      const studentName = topicTitle(chat, topicId);
      if (!studentName) continue;

      // Кто в этой ветке ученик: тот, кто пишет в ней под именем ветки.
      // Остальные (куратор, тёзка из другой ветки) в работы не попадают.
      const ownerId = resolveTopicOwnerId(messages, studentName);

      students.push({
        payload: buildStudentPayload({
          chatId: chat.chatId,
          authorName: studentName,
          authorUsername: usernames.get(studentName) ?? null,
          rootMessageId: topicId,
          intro: {},
          importKey: authorKeyOf(studentName, ownerId, ambiguous),
        }),
        postedAt: null,
      });

      const own = messages.filter((m) =>
        ownerId !== null ? m.authorId === ownerId : m.authorName === studentName,
      );
      const ownPosts = groupConsecutive(own).filter((p) => isLongPost(p));
      const { results: ownWorks, failedBatches: ownFailures } = await extractWorks(ownPosts, {
        onBatch: progress(`VIP ${studentName}`),
      });
      for (const f of ownFailures) failures.push({ ...f, chatId: chat.chatId, kind: 'work' });
      for (const post of ownPosts) {
        const fields = ownWorks.get(post.rootMessageId);
        if (!fields) continue;
        const payload = buildWorkPayload({
          chatId: chat.chatId,
          importKey: authorKeyOf(studentName, ownerId, ambiguous),
          rootMessageId: post.rootMessageId,
          postedAt: post.postedAt,
          text: post.text,
          source: 'vip_personal',
          work: fields,
        });
        if (payload) works.push(payload);
      }
    }
  }

  // Один и тот же проект нередко анонсируют, а потом дорабатывают отдельным
  // постом — без схлопывания это дало бы на витрине две карточки одной
  // работы с одинаковым live_url у одного ученика.
  const dedupedWorks = dedupeWorksByLiveUrl(works);

  if (args.dryRun) {
    console.log(
      `students: ${students.length}, works: ${dedupedWorks.length} (до дедупликации: ${works.length}), raw: ${rawRows.length}`,
    );
    for (const w of dedupedWorks) {
      console.log(`  [${w.cohort}] ${w.title} — ${w.live_url ?? 'без ссылки'}`);
    }
    printFailureSummary(failures);
    return { failures };
  }

  const db = getServiceClient();
  await writeAll(db, students, dedupedWorks, rawRows);
  printFailureSummary(failures);
  return { failures };
}

/**
 * Печатает сбои заметно и отдельно от обычного лога — их легко потерять
 * в потоке [upsert]/[dry]-строк, а именно они означают, что результат
 * неполный: часть постов до модели не дошла и в базу не попала.
 */
function printFailureSummary(failures: FailureContext[]): void {
  if (failures.length === 0) return;
  const postCount = failures.reduce((sum, f) => sum + f.rootMessageIds.length, 0);
  console.warn('');
  console.warn('!'.repeat(60));
  console.warn(
    `ВНИМАНИЕ: результат НЕПОЛНЫЙ. ${failures.length} батч(ей) LLM провалено, ${postCount} постов не обработано.`,
  );
  for (const f of failures) {
    console.warn(
      `  chat=${f.chatId} kind=${f.kind} rootMessageIds=[${f.rootMessageIds.join(',')}] error=${f.error}`,
    );
  }
  console.warn('Повторный прогон импорта доберёт эти посты (raw_messages/upsert идемпотентны).');
  console.warn('!'.repeat(60));
  console.warn('');
}

async function writeAll(
  db: SupabaseClient,
  students: StudentRecord[],
  works: WorkPayload[],
  rawRows: RawRow[],
): Promise<void> {
  // raw_messages: чистый UPSERT по id, всегда безопасно перезаписать.
  for (let i = 0; i < rawRows.length; i += 500) {
    const chunk = rawRows.slice(i, i + 500);
    const { error } = await db.from(tbl('raw_messages')).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
  console.log(`[upsert] raw_messages: ${rawRows.length} rows`);

  // students: (cohort, import_key) — select, mergeStudentFields, затем upsert
  // только тех полей, что импорту разрешено писать.
  const studentIdByKey = new Map<string, string>();
  let studentCount = 0;
  for (const { payload, postedAt } of students) {
    const key = `${payload.cohort}::${payload.import_key}`;
    if (studentIdByKey.has(key)) continue; // уже обработан в этом прогоне

    const id = await upsertStudent(db, payload, postedAt);
    studentIdByKey.set(key, id);
    studentCount++;
  }
  console.log(`[upsert] students: ${studentCount} rows`);

  // works: UPSERT по source_message_id, is_published передаём только на вставку.
  let workCount = 0;
  for (const work of works) {
    const key = `${work.cohort}::${work.import_key}`;
    let studentId = studentIdByKey.get(key);
    if (!studentId) {
      studentId = await ensureStudentStub(db, work.cohort, work.import_key, work.source_message_id);
      studentIdByKey.set(key, studentId);
    }
    await upsertWork(db, studentId, work);
    workCount++;
  }
  console.log(`[upsert] works: ${workCount} rows`);
}

async function upsertStudent(
  db: SupabaseClient,
  payload: StudentPayload,
  postedAt: string | null,
): Promise<string> {
  const { cohort, import_key, ...rest } = payload;
  const { data: existing, error: selectError } = await db
    .from(tbl('students'))
    .select('id, updated_at')
    .eq('cohort', cohort)
    .eq('import_key', import_key)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const merged = mergeStudentFields(rest, existing as { updated_at: string }, postedAt);
    if (Object.keys(merged).length > 0) {
      const { error } = await db.from(tbl('students')).update(merged).eq('id', existing.id);
      if (error) throw error;
    }
    return existing.id as string;
  }

  const { data, error } = await db
    .from(tbl('students'))
    .insert({ cohort, import_key, ...rest })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

/** Работа пришла раньше intro автора (или его вообще не было) — заводим минимальный профиль. */
async function ensureStudentStub(
  db: SupabaseClient,
  cohort: string,
  importKey: string,
  sourceMessageId: string,
): Promise<string> {
  const { data: existing, error: selectError } = await db
    .from(tbl('students'))
    .select('id')
    .eq('cohort', cohort)
    .eq('import_key', importKey)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from(tbl('students'))
    .insert({
      cohort,
      import_key: importKey,
      display_name: importKey,
      telegram_username: null,
      source_message_id: sourceMessageId,
      city: null,
      country: null,
      niche: null,
      bio: null,
      goal: null,
      expertise: null,
      hobbies: null,
      age: null,
      status: null,
      is_published: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function upsertWork(db: SupabaseClient, studentId: string, work: WorkPayload): Promise<void> {
  const { import_key: _importKey, cohort: _cohort, is_published, ...rest } = work;

  const { data: existing, error: selectError } = await db
    .from(tbl('works'))
    .select('id')
    .eq('source_message_id', work.source_message_id)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    // is_published сознательно не трогаем: повторный импорт не должен
    // ни снимать с витрины опубликованное учеником, ни публиковать спрятанное.
    const { error } = await db
      .from(tbl('works'))
      .update({ student_id: studentId, ...rest })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from(tbl('works')).insert({ student_id: studentId, is_published, ...rest });
  if (error) throw error;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[import] dump=${args.dumpFile}  dry-run=${args.dryRun}`);
  const { failures } = await run(args);
  if (failures.length > 0 && !args.dryRun) {
    // Данные, которые удалось извлечь, уже записаны — но молча рапортовать
    // об успехе на неполном результате нельзя: вызывающий (cron, оператор)
    // должен увидеть ненулевой код и разобраться, что не обработалось.
    process.exitCode = 1;
  }
}

// Запускать только при прямом вызове (`tsx scripts/import.ts`), не при
// импорте чистых функций тестами (`scripts/test/import.test.ts`). Путь к
// репозиторию содержит кириллицу и пробелы — сравниваем декодированные пути,
// а не сырой `file://` URL, иначе процентное экранирование ломает сравнение.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
