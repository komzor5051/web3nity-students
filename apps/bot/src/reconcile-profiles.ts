/**
 * Фоновая авто-сборка профилей.
 *
 * Берёт новые сообщения группы курса из raw_messages (которые бот пишет на
 * каждом сообщении), группирует подряд идущие, прогоняет через тот же
 * LLM-конвейер, что и одноразовый импорт, и раскладывает результат:
 *   - intro → поля профиля студента (city, niche, bio, goal, ...);
 *   - work  → запись в works.
 *
 * Запускается по таймеру из index.ts. Идемпотентна: обрабатывает только
 * raw_messages с processed_at IS NULL и ingested_from='bot_pull', после
 * обработки проставляет processed_at, поэтому повторно их не берёт.
 *
 * Политика (согласована с заказчиком):
 *   - AI всегда обновляет — извлечённые поля перезаписывают существующие;
 *   - собранный профиль сразу публикуется (is_published=true);
 *   - works из чата тоже публикуются (медиа пока не подтягиваются).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { tbl, type Student } from '@web3nity/db';
import {
  groupConsecutive,
  isLongPost,
  classifyPosts,
  normalizeAuthorKey,
  type ParsedMessage,
  type ClassifiedPost,
  type IntroFields,
} from '@web3nity/parser';

const COHORT = process.env.COHORT ?? 'AI-Ассистенты 3.0';
const FETCH_LIMIT = 400;

export interface ReconcileResult {
  fetched: number;
  intros: number;
  works: number;
}

/** raw_messages.id для bot_pull выглядит как `tg:<chat>:<message_id>`. */
export function parseMessageId(rawId: string): number | null {
  const last = rawId.split(':').pop();
  const n = last ? Number(last) : NaN;
  return Number.isInteger(n) ? n : null;
}

/** Патч профиля из intro — только непустые поля (пустые не трогаем). */
export function introPatch(intro: IntroFields): Partial<Student> {
  const p: Partial<Student> = {};
  if (intro.city) p.city = intro.city;
  if (intro.country) p.country = intro.country;
  if (intro.niche) p.niche = intro.niche;
  if (intro.bio) p.bio = intro.bio;
  if (intro.goal) p.goal = intro.goal;
  if (intro.expertise) p.expertise = intro.expertise;
  if (intro.hobbies) p.hobbies = intro.hobbies;
  if (typeof intro.age === 'number') p.age = intro.age;
  if (intro.status) p.status = intro.status;
  return p;
}

/** Из батча intro-постов одного автора берём самый полный. */
function bestIntro(a: IntroFields, b: IntroFields): IntroFields {
  const score = (x: IntroFields) =>
    Object.values(x).filter((v) => v !== undefined && v !== '').length;
  return score(b) > score(a) ? b : a;
}

export async function reconcileProfiles(db: SupabaseClient): Promise<ReconcileResult> {
  const { data: raws, error } = await db
    .from(tbl('raw_messages'))
    .select('id, author_tg_id, author_name, text, posted_at')
    .is('processed_at', null)
    .eq('ingested_from', 'bot_pull')
    .order('posted_at', { ascending: true })
    .limit(FETCH_LIMIT);
  if (error) throw error;
  if (!raws || raws.length === 0) return { fetched: 0, intros: 0, works: 0 };

  // raw → ParsedMessage; параллельно держим tg_id и сырой id по message_id.
  const tgIdByMsg = new Map<number, number | null>();
  const rawIdByMsg = new Map<number, string>();
  const parsed: ParsedMessage[] = [];
  for (const r of raws) {
    const mid = parseMessageId(r.id as string);
    if (mid == null || !r.author_name) continue;
    tgIdByMsg.set(mid, (r.author_tg_id as number | null) ?? null);
    rawIdByMsg.set(mid, r.id as string);
    parsed.push({
      messageId: mid,
      threadId: null,
      authorName: r.author_name as string,
      postedAt: (r.posted_at as string | null) ?? null,
      text: (r.text as string | null) ?? '',
      media: [],
      replyToId: null,
      isService: false,
      joined: false,
    });
  }

  const longPosts = groupConsecutive(parsed).filter((g) => isLongPost(g));

  let intros = 0;
  let works = 0;
  // classified_as по message_id — для пометки raw_messages в конце.
  const classByMsg = new Map<number, ClassifiedPost['classified_as']>();

  if (longPosts.length > 0) {
    const classified = await classifyPosts(longPosts);

    // 1. Собираем лучший intro на автора (по telegram-имени).
    const introByAuthor = new Map<string, { intro: IntroFields; tgId: number | null; sourceId: string; name: string }>();
    for (let i = 0; i < longPosts.length; i++) {
      const post = longPosts[i]!;
      const cls = classified[i]!;
      for (const mid of post.messageIds) classByMsg.set(mid, cls.classified_as);
      if (cls.classified_as !== 'intro' || !cls.intro) continue;
      const existing = introByAuthor.get(post.authorName);
      const merged = existing ? bestIntro(existing.intro, cls.intro) : cls.intro;
      introByAuthor.set(post.authorName, {
        intro: merged,
        tgId: tgIdByMsg.get(post.rootMessageId) ?? null,
        sourceId: rawIdByMsg.get(post.rootMessageId) ?? `tg:${post.rootMessageId}`,
        name: post.authorName,
      });
    }

    // 2. Применяем intro к профилям.
    for (const { intro, tgId, sourceId, name } of introByAuthor.values()) {
      const studentId = await resolveStudent(db, tgId, name, sourceId, true);
      if (!studentId) continue;
      await db
        .from(tbl('students'))
        .update({ ...introPatch(intro), is_published: true })
        .eq('id', studentId);
      intros++;
    }

    // 3. Применяем works.
    for (let i = 0; i < longPosts.length; i++) {
      const post = longPosts[i]!;
      const cls = classified[i]!;
      if (cls.classified_as !== 'work') continue;
      const tgId = tgIdByMsg.get(post.rootMessageId) ?? null;
      const sourceId = rawIdByMsg.get(post.rootMessageId) ?? `tg:${post.rootMessageId}`;
      const studentId = await resolveStudent(db, tgId, post.authorName, sourceId, true);
      if (!studentId) continue;
      const title =
        cls.work?.title?.trim() ||
        post.text.split('\n')[0]!.slice(0, 100) ||
        'Без названия';
      const { error: wErr } = await db.from(tbl('works')).upsert(
        {
          student_id: studentId,
          title,
          description: cls.work?.description ?? post.text.slice(0, 1000),
          media: [],
          tags: cls.work?.tags ?? [],
          source_message_id: sourceId,
          posted_at: post.postedAt,
          is_published: true,
        },
        { onConflict: 'source_message_id' },
      );
      if (!wErr) works++;
    }
  }

  // 4. Помечаем ВСЕ забранные сообщения обработанными (иначе берём их снова).
  await markProcessed(db, raws as { id: string }[], classByMsg);

  return { fetched: raws.length, intros, works };
}

/**
 * Находит студента по telegram_user_id, иначе по import_key (имени),
 * иначе создаёт нового. При создании профиль сразу публикуется.
 */
async function resolveStudent(
  db: SupabaseClient,
  tgId: number | null,
  authorName: string,
  sourceId: string,
  createIfMissing: boolean,
): Promise<string | null> {
  if (tgId != null) {
    const byId = await db
      .from(tbl('students'))
      .select('id')
      .eq('telegram_user_id', tgId)
      .maybeSingle();
    if (byId.data) return byId.data.id as string;
  }

  const key = normalizeAuthorKey(authorName);
  if (key) {
    const byKey = await db
      .from(tbl('students'))
      .select('id, telegram_user_id')
      .eq('cohort', COHORT)
      .eq('import_key', key);
    if (byKey.data && byKey.data.length === 1) {
      const row = byKey.data[0]!;
      if (tgId != null && row.telegram_user_id == null) {
        await db.from(tbl('students')).update({ telegram_user_id: tgId }).eq('id', row.id);
      }
      return row.id as string;
    }
  }

  if (!createIfMissing) return null;

  const { data, error } = await db
    .from(tbl('students'))
    .insert({
      telegram_user_id: tgId,
      display_name: authorName,
      import_key: key || null,
      cohort: COHORT,
      source_message_id: sourceId,
      is_published: true,
    })
    .select('id')
    .single();
  if (error) {
    console.warn('[reconcile] createStudent:', error.message);
    return null;
  }
  return data.id as string;
}

/** Проставляет processed_at + classified_as пачками по классу. */
async function markProcessed(
  db: SupabaseClient,
  raws: { id: string }[],
  classByMsg: Map<number, ClassifiedPost['classified_as']>,
): Promise<void> {
  const now = new Date().toISOString();
  const idsByClass = new Map<ClassifiedPost['classified_as'] | 'none', string[]>();
  for (const r of raws) {
    const mid = parseMessageId(r.id);
    const cls = mid != null ? classByMsg.get(mid) : undefined;
    const bucket = cls ?? 'none';
    const arr = idsByClass.get(bucket) ?? [];
    arr.push(r.id);
    idsByClass.set(bucket, arr);
  }
  for (const [bucket, ids] of idsByClass) {
    const patch = {
      processed_at: now,
      classified_as: bucket === 'none' ? null : bucket,
    };
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await db.from(tbl('raw_messages')).update(patch).in('id', chunk);
      if (error) console.warn('[reconcile] markProcessed:', error.message);
    }
  }
}
