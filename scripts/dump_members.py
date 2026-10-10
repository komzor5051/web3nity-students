#!/usr/bin/env python3
"""Список участников чатов курса — источник доступа к платформе.

Платформа закрыта для учеников: войти может только тот, чей Telegram ID есть
среди участников чатов VIBECODING (или добавлен организатором вручную).
Скрипт только читает списки участников и пишет их в JSON; в базу их кладёт
scripts/sync-members.ts.

    python3 scripts/dump_members.py --out data/members.json
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path.home() / "tg-archive"))
from tgcommon import make_client  # noqa: E402

CHATS = [-1004353204500, -1004413372752, -1003966609206, -1003709866237]


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/members.json")
    args = parser.parse_args()

    client = make_client()
    await client.start()
    members = {}
    try:
        for chat_id in CHATS:
            entity = await client.get_entity(chat_id)
            count = 0
            async for user in client.iter_participants(entity):
                if getattr(user, "bot", False) or getattr(user, "deleted", False):
                    continue
                name = " ".join(filter(None, [user.first_name, user.last_name])).strip()
                m = members.setdefault(user.id, {
                    "telegram_user_id": user.id,
                    "username": user.username,
                    "display_name": name or None,
                    "chats": [],
                })
                m["chats"].append(chat_id)
                count += 1
            print(f"{getattr(entity, 'title', chat_id)}: {count}", file=sys.stderr)
    finally:
        await client.disconnect()

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "members": list(members.values()),
    }
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"total unique: {len(members)} -> {args.out}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
