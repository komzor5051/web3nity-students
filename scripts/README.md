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
