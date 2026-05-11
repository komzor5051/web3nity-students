# web3nity-students

Публичная витрина студентов курса «AI-Ассистенты 3.0» (Web3nity) + Telegram-бот личного кабинета + пайплайн сбора данных из закрытого чата курса.

Полная дизайн-спека: [`docs/DESIGN.md`](docs/DESIGN.md).

## Для интегратора (handoff)

Что нужно знать тому, кто прикручивает витрину к сайту ai-education.io:

- **Витрину можно поднять отдельным сервисом** (`apps/web` — обычное Next.js 15 приложение, `output: 'standalone'`, деплой по `apps/web/Dockerfile`) и встроить на сайт по поддомену (`students.ai-education.io`) либо обратным прокси на путь `/students`.
- **Либо забрать только страницы** `apps/web/app/students/*` + `apps/web/lib/*` в существующий Next.js-проект сайта. Зависит только от `@supabase/supabase-js` и Tailwind.
- **БД и наполнение уже работают** — есть live preview (см. ниже). Чтобы переключить на свою/клиентскую инфраструктуру: поменять `SUPABASE_URL` / `SUPABASE_ANON_KEY` и обнулить `*_TABLE_PREFIX` / `*_BUCKET_PREFIX` (см. раздел «Текущий preview-деплой»).
- **Стиль витрины** подогнан под палитру ai-education.io: чёрный `#0F0F0F`, кремовый `#F5EFE5`, оранжевый акцент `#E94E1B`, чёрные обводки без теней (`apps/web/tailwind.config.js`). Подмените на реальные токены сайта при встраивании.
- **Бот** (`apps/bot`) автономен — отдельный сервис на Railway, public URL не нужен. Связь с витриной — только общая БД.
- Конфиг — переменные окружения, см. `.env.example` (корень) и `apps/web/.env.example`.

## Структура

```
apps/
  bot/        Telegraf.js бот (Railway, long-polling)
  web/        Next.js 15 App Router витрина (Railway / встраивание на сайт)
packages/
  db/         Supabase клиент, миграции, типы. Префикс таблиц через env.
  parser/     Парсер Telegram HTML-выгрузки + LLM-нормализация (Gemini 2.5 Flash)
scripts/
  import.ts   one-shot HTML-экспорт → Supabase (есть --dry-run и --out json)
  storage.ts  загрузка медиа из экспорта в Supabase Storage
docs/
  DESIGN.md   полная дизайн-спека
```

## Быстрый старт

```bash
npm install
cp .env.example .env
# заполнить SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

# применить миграцию (через psql или Supabase SQL Editor)
psql "$DATABASE_URL" < packages/db/migrations/0001_init.sql

# проверка: парсит выгрузку и печатает план без записи в БД
npm run import:dry -- --export-dir "/path/to/ChatExport_2026-05-08"

# боевой импорт (нужен SERVICE_ROLE_KEY)
npm run import -- --export-dir "/path/to/ChatExport_2026-05-08"

# локально витрина
npm run dev --workspace=@web3nity/web   # http://localhost:3000/students
# локально бот
npm run dev --workspace=@web3nity/bot
```

## Текущий статус

- [x] Дизайн-спека (`docs/DESIGN.md`)
- [x] Скелет монорепо (npm workspaces)
- [x] packages/db — миграции (`0001_init.sql`) + клиент Supabase + типы, префикс таблиц через env
- [x] packages/parser — HTML парсер (cheerio) + группировка joined-сообщений, юнит-тесты
- [x] packages/parser — LLM-классификация intro/work/qa/chat (Gemini 2.5 Flash, structured output, batch 20)
- [x] scripts/import.ts — оркестратор: `--dry-run` (без записи), `--out json` (дамп payload-ов), полный режим с загрузкой медиа в Storage
- [x] apps/web — Next.js 15 витрина (список + карточка студента + страница работы + OG)
- [x] apps/bot — Telegraf личный кабинет (`/start /agree /profile /edit /work_add /works /hide /show /forget`) + pull сообщений в `raw_messages` + **пассивная реконсиляция**: при чтении чата курса бот сам дозаписывает `telegram_user_id` / `telegram_username` импортированному профилю (по совпадению имени, только если совпадение единственное) — студенту не нужно специально заходить в бота. Требует Privacy Mode = off у бота.

## Стек

- **LLM**: Gemini 2.5 Flash (`@google/generative-ai`, structured output через `responseSchema`)
- **DB / Storage**: Supabase
- **Бот**: Telegraf, деплой на Railway (Dockerfile)
- **Витрина**: Next.js 15 standalone, деплой на Railway (Dockerfile)

## Текущий preview-деплой

- **Витрина (live)**: https://web-production-6299.up.railway.app/students — 69 профилей, 23 работы (импорт из выгрузки 2026-05-08)
- **Railway**: проект `web3nity-students`, сервис `web`
- **Supabase**: временно в общем проекте **lvmn-hub** (`kjkwbcnurljlebqiqxlz`), таблицы с префиксом `web3nity_`, бакеты `web3nity-*` — лимит free-проектов на пользователя был исчерпан (lvmn-hub + Swipely). При получении отдельного проекта клиента: сменить URL/ключи и обнулить `SUPABASE_TABLE_PREFIX` / `SUPABASE_BUCKET_PREFIX` / `NEXT_PUBLIC_SUPABASE_TABLE_PREFIX`.
- Импорт сделан в JSON-dump режиме (`--out`) + загрузка через временные RLS-политики (уже удалены). Для повторного/боевого импорта и для бота нужен `SUPABASE_SERVICE_ROLE_KEY` (Supabase → lvmn-hub → Settings → API → service_role).

## Что осталось (внешние действия, нужны ключи)

- [ ] Создать Supabase-проект клиента → применить `packages/db/migrations/0001_init.sql`
- [ ] Получить `GEMINI_API_KEY` (https://aistudio.google.com/apikey) → положить в `.env`
- [ ] Прогнать `npm run import:dry -- --export-dir "/path/to/ChatExport_2026-05-08"` на реальной выгрузке, посмотреть классификацию, при необходимости подкрутить промпт
- [ ] Боевой `npm run import` — наполнить БД
- [ ] Зарегистрировать бота в @BotFather, получить токен → `TELEGRAM_BOT_TOKEN`
- [ ] Договориться с Hannah, чтобы добавила бота админом в чат "AI-АССИСТЕНТЫ 3.0" (с правом чтения сообщений, Privacy Mode выключить через @BotFather → /setprivacy → Disable)
- [ ] Узнать chat_id чата → `TELEGRAM_CHAT_ID`

## Деплой на Railway

Два сервиса в одном проекте, оба используют монорепо как build context.

### Bot (apps/bot)

1. New Service → GitHub repo / Deploy from CLI
2. Settings → Root directory: `/` (корень монорепо), Build → Dockerfile path: `apps/bot/Dockerfile`
3. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `COHORT`, `SITE_URL`
4. Deploy. Бот запускается по long-polling, public URL не нужен.

### Web (apps/web)

1. New Service в том же проекте
2. Settings → Root directory: `/`, Build → Dockerfile path: `apps/web/Dockerfile`
3. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Networking → Generate domain (или прицепить свой)
5. `SITE_URL` бота прописать на это же domain — бот шлёт студентам ссылки `<SITE_URL>/<slug>`

`railway.json` в каждом сервисе указывает Dockerfile, так что Railway подхватит конфиг автоматически.

## Архитектурные заметки

- **`telegram_user_id` — nullable.** HTML-выгрузка не содержит tg_id. Пишем профили
  по natural key `(cohort, import_key)`, где `import_key = lowercase(authorName)`. Бот
  при первой live-встрече сматчит автора по имени и заполнит `telegram_user_id`.
- **`works.is_published = false` по умолчанию** — спека требует opt-in от студента.
- **`raw_messages.id`** — `html:<message_id>` для импорта, `tg:<chat>:<message_id>` для бота.
  Хранит весь поток для повторной классификации без репарсинга.
- **Идемпотентность импорта** — UPSERT по `(cohort, import_key)` для students и по
  `source_message_id` для works. Если `students.updated_at - intro.posted_at > 60s`
  (студент редактировал через бот) — поля не перетираются.
