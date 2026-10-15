# Скрипты

## dump_telegram.py

Локальный дамп трёх чатов курса в `data/dump.json`. Требует сессию
`~/tg-archive/lvmn.session`. Дамп содержит личную переписку из VIP-чата,
поэтому `data/` в `.gitignore` — не коммитить.

    python3 scripts/dump_telegram.py --out data/dump.json

## import.ts

Дамп → Supabase. Всегда прогонять сначала с `--dry-run`.

    npm run import:dry
    npm run import

## screenshots.ts

Скриншоты живых сайтов из works.live_url в бакет vibe-works-media.

    npm run screenshots

## Курсы

Платформа разделена на два курса: `vibecoding` и `assistants` (реестр —
`packages/db/src/courses.ts`). `dump_members.py` пишет участников по обоим
курсам, по записи на каждую пару (человек, курс); `sync-members.ts` кладёт их
в `vibe_members` с ключом `(telegram_user_id, course)`. Миграция —
`supabase/migrations/20261015_courses.sql`, применяется вручную до запуска
`npm run members`. `recommend` идёт по курсам отдельно (`-- --course assistants`).
Импорт анкет пока ведёт только чаты вайбкодинга.
