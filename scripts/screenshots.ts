#!/usr/bin/env tsx
/**
 * Скриншоты живых сайтов учеников.
 *
 *   npm run screenshots            # только те, где скриншота ещё нет
 *   npm run screenshots -- --all   # переснять всё
 *
 * Битая ссылка не роняет прогон: работа помечается screenshot_failed,
 * карточка на витрине рисует типографскую заглушку с доменом.
 *
 * live_url приходит из пользовательского ввода и из чата — перед тем как
 * открыть его в Playwright, проверяем схему и адрес (url-safety.ts).
 * Без этой проверки скриншотер стал бы инструментом обхода сетевого
 * периметра: мог бы по запросу заглянуть на localhost или в облачный
 * metadata endpoint.
 *
 * Одной проверки ДО перехода недостаточно: между ней и реальным TCP-
 * соединением DNS-ответ может смениться (rebinding), а сайт может
 * отредиректить на внутренний адрес уже после проверки хоста. Поэтому
 * после page.goto решающей становится проверка фактического адреса
 * соединения (response.serverAddr()) и итогового URL после редиректов —
 * см. assertConnectedAddressSafe/assertUrlShapeSafe в url-safety.ts.
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { getServiceClient, tbl, bucket } from '@vibe/db';
import { assertUrlSafeToFetch, assertUrlShapeSafe, assertConnectedAddressSafe, UnsafeUrlError } from './url-safety.js';

const VIEWPORT = { width: 1280, height: 800 };
const NAV_TIMEOUT_MS = 20_000;
/** Пауза после загрузки: анимации на лендингах успевают доиграть. */
const SETTLE_MS = 1_500;

/**
 * Обновляет статус работы и явно сообщает, если сама запись в базу не
 * удалась — иначе локальный счётчик ok/failed разойдётся с тем, что
 * реально лежит в БД, и прогон молча соврёт об успехе.
 */
async function markStatus(
  db: ReturnType<typeof getServiceClient>,
  workId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from(tbl('works')).update(fields).eq('id', workId);
  if (error) {
    console.warn(`  ВНИМАНИЕ: не удалось записать статус для work ${workId}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const all = process.argv.includes('--all');
  const db = getServiceClient();

  let query = db
    .from(tbl('works'))
    .select('id, live_url, screenshot_path')
    .not('live_url', 'is', null);
  if (!all) query = query.is('screenshot_path', null);

  const { data: works, error } = await query;
  if (error) throw error;
  if (!works?.length) {
    console.log('Нечего снимать.');
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  let ok = 0;
  let failed = 0;

  for (const work of works) {
    const liveUrl = work.live_url as string;

    try {
      await assertUrlSafeToFetch(liveUrl);
    } catch (e) {
      await markStatus(db, work.id, { screenshot_failed: true });
      failed++;
      const reason = e instanceof UnsafeUrlError ? e.message : String(e);
      console.warn(`  fail ${liveUrl}: адрес отклонён проверкой безопасности (${reason})`);
      continue;
    }

    const page = await context.newPage();
    try {
      const response = await page.goto(liveUrl, {
        timeout: NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      if (!response) throw new Error('страница не вернула ответ');

      // Решающая проверка: реальный адрес, к которому подключился браузер.
      // Проверка URL до перехода могла увидеть другой (валидный) адрес —
      // DNS-ответ мог смениться между проверкой и соединением.
      const serverAddr = await response.serverAddr();
      if (!serverAddr) {
        // Нет данных о соединении (например, ответ отдан из кэша/service
        // worker без реального сетевого запроса) — не можем подтвердить
        // безопасность адреса, значит не доверяем результату.
        throw new UnsafeUrlError('не удалось получить адрес соединения (serverAddr пуст)');
      }
      assertConnectedAddressSafe(serverAddr.ipAddress);

      // Итоговый URL после всех редиректов — легитимные редиректы (apex →
      // www, http → https) это не ловит, только смену схемы или хост из
      // запрещённого диапазона/localhost.
      assertUrlShapeSafe(response.url());

      await page.waitForTimeout(SETTLE_MS);
      const buffer = await page.screenshot({ type: 'png' });

      const path = `${work.id}.png`;
      const up = await db.storage
        .from(bucket('works-media'))
        .upload(path, buffer, { contentType: 'image/png', upsert: true });
      if (up.error) throw up.error;

      await markStatus(db, work.id, { screenshot_path: path, screenshot_failed: false });
      ok++;
      console.log(`  ok   ${liveUrl}`);
    } catch (e) {
      await markStatus(db, work.id, { screenshot_failed: true });
      failed++;
      if (e instanceof UnsafeUrlError) {
        // Отдельно от обычной недоступности сайта: тут не «сайт не открылся»,
        // а «браузер подключился не туда, куда должен был».
        console.warn(`  fail ${liveUrl}: проверка адреса ПОСЛЕ соединения отклонила результат (${e.message})`);
      } else {
        console.warn(`  fail ${liveUrl}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`Готово: ${ok} снято, ${failed} недоступно.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
