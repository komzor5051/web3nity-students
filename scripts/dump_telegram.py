#!/usr/bin/env python3
"""Дамп чатов курса по вайб-кодингу в JSON для импорта на витрину.

Запускается локально, использует существующую сессию ~/tg-archive/lvmn.session.
В продакшен не едет: Railway работает только с Supabase.

    python3 scripts/dump_telegram.py --out data/dump.json
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path.home() / "tg-archive"))
from tgcommon import make_client  # noqa: E402

CHATS = [-1004353204500, -1004413372752, -1003966609206]


def topic_id_of(msg):
    """id ветки форума. Telethon кладёт его в reply_to_top_id, а для первого
    ответа в ветке — в reply_to_msg_id. Сообщения вне веток дают None."""
    reply = getattr(msg, "reply_to", None)
    if reply is None:
        return None
    return getattr(reply, "reply_to_top_id", None) or getattr(reply, "reply_to_msg_id", None)


async def dump_chat(client, chat_id):
    entity = await client.get_entity(chat_id)
    messages = []
    async for msg in client.iter_messages(entity):
        messages.append(msg)
    messages.reverse()

    topics = {}
    for msg in messages:
        action = getattr(msg, "action", None)
        title = getattr(action, "title", None)
        if title:
            topics[str(msg.id)] = title

    out = []
    for msg in messages:
        if getattr(msg, "action", None) is not None:
            continue
        sender = msg.sender
        first = getattr(sender, "first_name", None) or ""
        last = getattr(sender, "last_name", None) or ""
        name = (f"{first} {last}".strip()) or getattr(sender, "title", None)
        out.append({
            "message_id": msg.id,
            "topic_id": topic_id_of(msg),
            "author_id": msg.sender_id,
            "author_name": name,
            "author_username": getattr(sender, "username", None),
            "posted_at": msg.date.isoformat() if msg.date else None,
            "text": (msg.text or "").strip(),
            "has_media": bool(msg.media),
            "reply_to_id": getattr(getattr(msg, "reply_to", None), "reply_to_msg_id", None),
        })

    return {
        "chat_id": chat_id,
        "title": getattr(entity, "title", str(chat_id)),
        "topics": topics,
        "messages": out,
    }


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data/dump.json")
    args = parser.parse_args()

    client = make_client()
    await client.start()
    chats = [await dump_chat(client, cid) for cid in CHATS]
    await client.disconnect()

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "chats": chats,
    }
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(len(c["messages"]) for c in chats)
    for c in chats:
        print(f"  {c['title']}: {len(c['messages'])} сообщений, {len(c['topics'])} веток")
    print(f"Записано {total} сообщений в {path}")


asyncio.run(main())
