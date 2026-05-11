import 'dotenv/config';
import { Telegraf, Markup, type Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { getServiceClient, tbl, bucket, type Student } from '@web3nity/db';
import {
  getSession,
  setSession,
  clearSession,
  type EditField,
  type SessionState,
} from './session.js';
import {
  getOrAttachStudent,
  updateStudentField,
  setPublished,
  deleteStudent,
  reconcileFromChat,
} from './students.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');

const SITE_URL = process.env.SITE_URL ?? 'https://ai-education.io/students';

const bot = new Telegraf(TOKEN);
const db = getServiceClient();

// === Группа курса: фоновое чтение всех сообщений ===
//
// Этот middleware регистрируется ПЕРВЫМ. Для не-личных чатов он сам обрабатывает
// сообщение (запись в raw_messages + дозапись username) и НЕ пропускает дальше —
// личный кабинет (команды, FSM) работает только в личке. Для лички — next().

const CHAT_ID = process.env.TELEGRAM_CHAT_ID ? Number(process.env.TELEGRAM_CHAT_ID) : null;
const seenChats = new Set<number>();

function describeMedia(m: Record<string, unknown>): { type: string; filename?: string }[] | null {
  const out: { type: string; filename?: string }[] = [];
  if (Array.isArray(m.photo)) out.push({ type: 'image' });
  if (m.video) out.push({ type: 'video' });
  if (m.animation) out.push({ type: 'video' });
  if (m.document) out.push({ type: 'file', filename: (m.document as { file_name?: string }).file_name });
  if (m.voice || m.video_note) out.push({ type: 'voice' });
  if (m.sticker) out.push({ type: 'sticker' });
  return out.length ? out : null;
}

bot.use(async (ctx, next) => {
  if (!ctx.chat || ctx.chat.type === 'private') return next();

  // --- группа / супергруппа / канал ---
  const msg = ctx.message ?? ctx.editedMessage;
  const text = msg && 'text' in msg ? String((msg as { text?: string }).text ?? '') : '';

  if (text === '/chatid' || text.startsWith('/chatid@')) {
    const title = 'title' in ctx.chat ? ctx.chat.title : '';
    await ctx.reply(
      `chat_id этой группы: ${ctx.chat.id}\n` +
        `Пропишите TELEGRAM_CHAT_ID=${ctx.chat.id} в переменных бота на сервере и перезапустите.`,
    );
    console.log(`[group] /chatid в "${title}" → ${ctx.chat.id}`);
    return;
  }

  if (!msg) return; // service-обновления (вступления/выходы и т.п.)

  if (CHAT_ID == null) {
    if (!seenChats.has(ctx.chat.id)) {
      seenChats.add(ctx.chat.id);
      const title = 'title' in ctx.chat ? ctx.chat.title : '';
      console.log(
        `[group] сообщение из чата ${ctx.chat.id} ("${title}"). TELEGRAM_CHAT_ID не задан — запись отключена. ` +
          `Задайте TELEGRAM_CHAT_ID=${ctx.chat.id} чтобы включить.`,
      );
    }
    return;
  }
  if (ctx.chat.id !== CHAT_ID) return;

  const m = msg as unknown as Record<string, unknown> & { message_id: number; date: number };
  try {
    await db.from(tbl('raw_messages')).upsert(
      {
        id: `tg:${ctx.chat.id}:${m.message_id}`,
        thread_id: (m.message_thread_id as number | undefined) ?? null,
        author_tg_id: ctx.from?.id ?? null,
        author_name: ctx.from
          ? [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
          : null,
        text: (m.text as string | undefined) ?? (m.caption as string | undefined) ?? null,
        media: describeMedia(m),
        posted_at: new Date(m.date * 1000).toISOString(),
        ingested_from: 'bot_pull' as const,
      },
      { onConflict: 'id' },
    );
  } catch (e) {
    console.warn('[raw_messages] ', e);
  }

  if (ctx.from && !ctx.from.is_bot) {
    await reconcileFromChat(db, {
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
    }).catch((e) => console.warn('[reconcile] ', e));
  }
  // намеренно не вызываем next() — личный кабинет в группах не нужен
});

// === Команды (только личка — см. middleware выше) ===

bot.command('chatid', (ctx) => ctx.reply(`chat_id: ${ctx.chat.id}`));

bot.start(async (ctx) => {
  const tgUser = ctx.from;
  if (!tgUser) return;
  const student = await getOrAttachStudent(db, {
    id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name,
  });

  if (!student.is_published) {
    await setSession(db, tgUser.id, { kind: 'awaiting_consent' });
    await ctx.reply(
      [
        'Привет. Это бот витрины студентов курса AI-Ассистенты 3.0.',
        '',
        'Твой профиль будет опубликован в открытом интернете на странице студентов курса.',
        'Контакт = @username (если указан в Telegram).',
        '',
        'Что показываем: имя, ниша, город, био, кейсы — то, что ты сам подтвердишь.',
        '',
        'Согласен на публикацию? /agree или /no_thanks',
      ].join('\n'),
    );
    return;
  }

  await ctx.reply(welcomeText(student), { parse_mode: 'HTML' });
});

bot.command('agree', async (ctx) => {
  if (!ctx.from) return;
  const student = await getOrAttachStudent(db, ctx.from);
  await setPublished(db, student.id, true);
  await clearSession(db, ctx.from.id);
  await ctx.reply(
    `Готово. Твой профиль опубликован: ${profileUrl(student)}\n\nКоманды: /profile /edit /work_add /works /hide /forget /help`,
  );
});

bot.command('no_thanks', async (ctx) => {
  if (!ctx.from) return;
  await clearSession(db, ctx.from.id);
  await ctx.reply('Хорошо. Не публикуем. Если передумаешь — напиши /start.');
});

bot.help((ctx) =>
  ctx.reply(
    [
      '/profile — твой профиль',
      '/edit — отредактировать поле',
      '/work_add — добавить работу',
      '/works — мои работы',
      '/hide — снять профиль с витрины',
      '/show — вернуть на витрину',
      '/forget — удалить профиль и работы',
      '/help — эта справка',
    ].join('\n'),
  ),
);

bot.command('profile', async (ctx) => {
  if (!ctx.from) return;
  const student = await getOrAttachStudent(db, ctx.from);
  await ctx.reply(profileText(student), { parse_mode: 'HTML' });
});

bot.command('hide', async (ctx) => {
  if (!ctx.from) return;
  const s = await getOrAttachStudent(db, ctx.from);
  await setPublished(db, s.id, false);
  await ctx.reply('Профиль скрыт с витрины. /show чтобы вернуть.');
});

bot.command('show', async (ctx) => {
  if (!ctx.from) return;
  const s = await getOrAttachStudent(db, ctx.from);
  await setPublished(db, s.id, true);
  await ctx.reply(`Профиль снова на витрине: ${profileUrl(s)}`);
});

bot.command('forget', async (ctx) => {
  if (!ctx.from) return;
  await deleteStudent(db, ctx.from.id);
  await ctx.reply('Профиль и работы удалены. Сообщения чата остаются в логе для аудита.');
});

bot.command('edit', async (ctx) => {
  await ctx.reply(
    'Что меняем?',
    Markup.inlineKeyboard(
      [
        ['display_name', 'Имя'],
        ['niche', 'Ниша'],
        ['city', 'Город'],
        ['country', 'Страна'],
        ['bio', 'Био'],
        ['goal', 'Зачем учусь'],
        ['expertise', 'Экспертиза'],
        ['hobbies', 'Хобби'],
        ['age', 'Возраст'],
        ['status', 'Статус'],
      ].map(([k, label]) => [Markup.button.callback(label!, `edit:${k}`)]),
    ),
  );
});

bot.action(/^edit:(.+)$/, async (ctx) => {
  if (!ctx.from) return;
  const field = ctx.match[1] as EditField;
  if (field === 'status') {
    await ctx.editMessageText(
      'Выбери статус',
      Markup.inlineKeyboard([
        [Markup.button.callback('Ищу клиентов', 'status:looking_for_clients')],
        [Markup.button.callback('Ищу партнёров', 'status:looking_for_partners')],
        [Markup.button.callback('Просто учусь', 'status:just_learning')],
        [Markup.button.callback('Сбросить', 'status:none')],
      ]),
    );
    return;
  }
  await setSession(db, ctx.from.id, { kind: 'edit_field', field });
  await ctx.editMessageText(`Окей, пришли новое значение для "${fieldLabel(field)}".`);
});

bot.action(/^status:(.+)$/, async (ctx) => {
  if (!ctx.from) return;
  const value = ctx.match[1];
  const student = await getOrAttachStudent(db, ctx.from);
  await updateStudentField(db, student.id, {
    status: value === 'none' ? null : (value as Student['status']),
  });
  await ctx.editMessageText('Статус обновлён.');
});

bot.command('work_add', async (ctx) => {
  if (!ctx.from) return;
  await setSession(db, ctx.from.id, { kind: 'work_title' });
  await ctx.reply('Заголовок работы (3-7 слов)?');
});

bot.command('works', async (ctx) => {
  if (!ctx.from) return;
  const s = await getOrAttachStudent(db, ctx.from);
  const { data: works } = await db
    .from(tbl('works'))
    .select('id, title, is_published, posted_at')
    .eq('student_id', s.id)
    .order('updated_at', { ascending: false });
  if (!works || works.length === 0) {
    await ctx.reply('Пока нет работ. /work_add — добавить первую.');
    return;
  }
  const lines = works
    .map(
      (w) =>
        `• ${w.title} ${w.is_published ? '(опубликовано)' : '(черновик)'}\n  /work_${w.id.slice(0, 8)}`,
    )
    .join('\n');
  await ctx.reply(`Твои работы:\n${lines}`);
});

// === FSM текстовые сообщения ===

bot.on(message('text'), async (ctx) => {
  if (!ctx.from) return;
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;

  const session = await getSession(db, ctx.from.id);
  const student = await getOrAttachStudent(db, ctx.from);

  switch (session.kind) {
    case 'edit_field': {
      await applyEditField(student.id, session.field, text);
      await clearSession(db, ctx.from.id);
      await ctx.reply(`Сохранено. ${profileUrl(student)}`);
      return;
    }
    case 'work_title': {
      await setSession(db, ctx.from.id, { kind: 'work_description', title: text });
      await ctx.reply('Опиши кейс в 1-3 предложениях.');
      return;
    }
    case 'work_description': {
      await setSession(db, ctx.from.id, {
        kind: 'work_media',
        title: session.title,
        description: text,
        media: [],
      });
      await ctx.reply(
        'Теперь пришли скрины / видео (можно несколько сообщений). Когда закончишь — напиши «готово».',
      );
      return;
    }
    case 'work_media': {
      if (text.toLowerCase().includes('готово')) {
        await setSession(db, ctx.from.id, {
          kind: 'work_tags',
          title: session.title,
          description: session.description,
          media: session.media,
        });
        await ctx.reply('Теги через запятую (например: n8n, телеграм-бот, crm).');
        return;
      }
      await ctx.reply('Жду медиа. Когда всё — напиши «готово».');
      return;
    }
    case 'work_tags': {
      const tags = text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
      await db.from(tbl('works')).insert({
        student_id: student.id,
        title: session.title,
        description: session.description,
        media: session.media,
        tags,
        is_published: true,
        posted_at: new Date().toISOString(),
        source_message_id: `bot:${Date.now()}:${ctx.from.id}`,
      });
      await clearSession(db, ctx.from.id);
      await ctx.reply(`Работа опубликована. ${profileUrl(student)}`);
      return;
    }
    default:
      // нет активного состояния — игнор
      return;
  }
});

// Медиа в режиме работы.
bot.on(message('photo'), async (ctx) => handleWorkMedia(ctx, 'image'));
bot.on(message('video'), async (ctx) => handleWorkMedia(ctx, 'video'));
bot.on(message('document'), async (ctx) => handleWorkMedia(ctx, 'file'));

async function handleWorkMedia(ctx: Context, kind: 'image' | 'video' | 'file') {
  if (!ctx.from || !ctx.message) return;
  const session = await getSession(db, ctx.from.id);
  if (session.kind !== 'work_media') return;

  // Берём наибольшее фото / видео / документ.
  let fileId: string | undefined;
  let filename: string | undefined;
  const m = ctx.message as unknown as Record<string, unknown>;
  if (kind === 'image' && Array.isArray(m.photo)) {
    const arr = m.photo as { file_id: string }[];
    fileId = arr[arr.length - 1]?.file_id;
  } else if (kind === 'video' && m.video) {
    fileId = (m.video as { file_id: string }).file_id;
  } else if (kind === 'file' && m.document) {
    const doc = m.document as { file_id: string; file_name?: string };
    fileId = doc.file_id;
    filename = doc.file_name;
  }
  if (!fileId) return;

  // Скачиваем через Telegram API → загружаем в Storage.
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.toString());
  if (!res.ok) {
    await ctx.reply('Не получилось скачать файл из Telegram. Попробуй ещё раз.');
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 20 * 1024 * 1024) {
    await ctx.reply('Файл больше 20 МБ. Пришли ссылку (YouTube, Drive и т.п.) текстом.');
    return;
  }

  const student = await getOrAttachStudent(db, ctx.from);
  const ext = (filename && filename.match(/\.[a-zA-Z0-9]+$/)?.[0]) ?? defaultExt(kind);
  const key = `${student.id}/bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const up = await db.storage.from(bucket('works-media')).upload(key, buf, { upsert: false });
  if (up.error) {
    await ctx.reply('Не удалось сохранить файл. Попробуй позже.');
    return;
  }
  const url = db.storage.from(bucket('works-media')).getPublicUrl(key).data.publicUrl;

  const updated: SessionState = {
    ...session,
    media: [...session.media, { type: kind === 'file' ? 'pdf' : kind, url, caption: filename }],
  };
  await setSession(db, ctx.from.id, updated);
  await ctx.reply(`Принял. Всего файлов: ${updated.media.length}. Можно ещё или «готово».`);
}

function defaultExt(kind: 'image' | 'video' | 'file'): string {
  if (kind === 'image') return '.jpg';
  if (kind === 'video') return '.mp4';
  return '';
}

// === Helpers ===

function profileUrl(s: Student): string {
  const slug = s.telegram_username || (s.import_key ?? s.id.slice(0, 8));
  return `${SITE_URL}/${encodeURIComponent(slug)}`;
}

function welcomeText(s: Student): string {
  return [
    `Снова привет, ${s.display_name}.`,
    `Твой профиль: ${profileUrl(s)}`,
    '',
    '/profile  /edit  /work_add  /works  /hide  /forget  /help',
  ].join('\n');
}

function profileText(s: Student): string {
  const lines = [
    `<b>${s.display_name}</b>`,
    s.niche ? `Ниша: ${s.niche}` : null,
    [s.city, s.country].filter(Boolean).join(', ') || null,
    s.age ? `Возраст: ${s.age}` : null,
    s.bio ? `\n${s.bio}` : null,
    s.goal ? `\nЦель: ${s.goal}` : null,
    s.expertise ? `\nЭкспертиза: ${s.expertise}` : null,
    s.hobbies ? `\nХобби: ${s.hobbies}` : null,
    s.status ? `\nСтатус: ${statusLabel(s.status)}` : null,
    `\n${profileUrl(s)}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function statusLabel(s: NonNullable<Student['status']>): string {
  if (s === 'looking_for_clients') return 'ищу клиентов';
  if (s === 'looking_for_partners') return 'ищу партнёров';
  return 'учусь';
}

function fieldLabel(f: EditField): string {
  const map: Record<EditField, string> = {
    display_name: 'Имя',
    city: 'Город',
    country: 'Страна',
    niche: 'Ниша',
    bio: 'Био',
    goal: 'Зачем учусь',
    expertise: 'Экспертиза',
    hobbies: 'Хобби',
    age: 'Возраст',
    status: 'Статус',
  };
  return map[f];
}

async function applyEditField(studentId: string, field: EditField, value: string): Promise<void> {
  const patch: Partial<Student> = {};
  if (field === 'age') {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 10 && n < 100) patch.age = n;
  } else if (field === 'status') {
    if (['looking_for_clients', 'looking_for_partners', 'just_learning'].includes(value)) {
      patch.status = value as Student['status'];
    }
  } else {
    (patch as Record<string, unknown>)[field] = value.slice(0, 2000);
  }
  await updateStudentField(getServiceClient(), studentId, patch);
}

bot.launch();
console.log(
  `[bot] running. site=${SITE_URL}  course_chat=${CHAT_ID ?? '(не задан — добавьте бота в группу и пришлите /chatid)'}`,
);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
