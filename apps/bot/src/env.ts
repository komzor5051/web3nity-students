/**
 * Загрузка .env ДО инициализации остальных модулей.
 *
 * В ESM статические импорты хойстятся: вызов loadEnv() в теле index.ts
 * выполняется уже ПОСЛЕ того, как @vibe/db прочитал process.env и захватил
 * пустой SUPABASE_TABLE_PREFIX. Поэтому dotenv живёт в отдельном модуле,
 * который index.ts импортирует первым — порядок инициализации импортов
 * гарантирован спецификацией.
 *
 * Переменные живут в корневом .env монорепо, а npm workspaces запускают пакет
 * с cwd = apps/bot — путь считаем от файла, не от cwd. На Railway .env нет,
 * переменные приходят от платформы: dotenv молча ничего не перетирает.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
