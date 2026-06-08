import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { getServiceClient, tbl } from '@web3nity/db';
import { getOrAttachStudent } from './students.js';
import { ensureAvatar } from './avatar.js';

// === Бот = только авторизация ===
//
// Всё редактирование профиля и работ происходит на сайте (apps/web/app/profile).
// Бот делает ровно одно: подтверждает deep-link вход `/start auth_<token>`,
// привязывая Telegram-аккаунт к карточке студента. Заодно при входе тянет
// аватар из Telegram, если его ещё нет. Никаких команд, FSM, чтения чата.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is required');

const SITE_URL = process.env.SITE_URL ?? 'https://ai-education.io/students';

const bot = new Telegraf(TOKEN);
const db = getServiceClient();

// Группы/каналы игнорируем целиком — бот работает только в личке и только на вход.
bot.use(async (ctx, next) => {
  if (ctx.chat && ctx.chat.type !== 'private') return; // ничего не отправляем, не читаем
  return next();
});

bot.start(async (ctx) => {
  const tgUser = ctx.from;
  if (!tgUser) return;

  const student = await getOrAttachStudent(db, {
    id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
    last_name: tgUser.last_name,
  });

  // Подтягиваем фото профиля из Telegram, если аватара ещё нет.
  // Fire-and-forget: вход блокировать нельзя, осечка не должна ронять /start.
  void ensureAvatar(ctx, db, student).catch((e) => console.warn('[avatar] ', e));

  // Deep-link вход: /start auth_<token>. payload — из ctx.startPayload.
  const payload = (ctx as unknown as { startPayload?: string }).startPayload ?? '';
  if (payload.startsWith('auth_')) {
    const token = payload.slice('auth_'.length);
    const upd = await db
      .from(tbl('web_auth_tokens'))
      .update({
        telegram_user_id: tgUser.id,
        student_id: student.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('token', token)
      .is('confirmed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('token')
      .maybeSingle();
    if (upd.data) {
      await ctx.reply(
        `Готово, ${student.display_name}. Вы вошли на сайте — открывайте и заполняйте профиль.`,
        Markup.inlineKeyboard([[Markup.button.url('Открыть сайт', SITE_URL)]]),
      );
      return;
    }
    await ctx.reply('Ссылка для входа устарела или уже использована. Откройте вход на сайте заново.');
    return;
  }

  // Голый /start без токена — пользователь открыл бота напрямую. Вход начинается с сайта.
  await ctx.reply(
    'Это бот витрины студентов курса. Вход и весь профиль — на сайте: нажмите «Войти» там, и вернётесь сюда подтвердить.',
    Markup.inlineKeyboard([[Markup.button.url('Открыть сайт', SITE_URL)]]),
  );
});

// launch с graceful-ретраем.
//
// При перевыкатке на Railway новый контейнер ненадолго пересекается со старым —
// оба зовут getUpdates, Telegram отвечает 409. Без обработки промис launch()
// реджектится, процесс падает и Railway уводит сервис в рестарт-петлю. Здесь
// 409 — не фатал: ждём и пробуем снова, пока старый инстанс не отвалится.
function launchWithRetry(attempt = 0): void {
  bot
    .launch(() => {
      console.log(`[bot] running (auth-only). site=${SITE_URL}`);
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      const is409 = /409/.test(msg) || /terminated by other getUpdates/.test(msg);
      const delayMs = is409 ? 15_000 : 5_000;
      console.warn(`[bot] launch failed (attempt ${attempt + 1}): ${msg}. retry in ${delayMs}ms`);
      setTimeout(() => launchWithRetry(attempt + 1), delayMs);
    });
}

launchWithRetry();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
