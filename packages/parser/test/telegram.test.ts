import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readDump, toParsedMessages, topicTitle } from '../src/telegram.js';
import { groupConsecutive } from '../src/group.js';

const FIXTURE = path.join(__dirname, 'fixtures/dump.json');

describe('readDump', () => {
  it('читает чаты из дампа', async () => {
    const chats = await readDump(FIXTURE);
    expect(chats).toHaveLength(1);
    expect(chats[0]!.chatId).toBe(-1004353204500);
    expect(chats[0]!.messages).toHaveLength(4);
  });
});

describe('toParsedMessages', () => {
  it('заполняет threadId — в отличие от HTML-выгрузки', async () => {
    const [chat] = await readDump(FIXTURE);
    const parsed = toParsedMessages(chat!);
    expect(parsed[0]!.threadId).toBe(10);
    expect(parsed[2]!.threadId).toBe(11);
  });

  it('сохраняет порядок и id сообщений', async () => {
    const [chat] = await readDump(FIXTURE);
    const parsed = toParsedMessages(chat!);
    expect(parsed.map((m) => m.messageId)).toEqual([100, 101, 200, 201]);
  });

  it('переносит имя автора', async () => {
    const [chat] = await readDump(FIXTURE);
    const parsed = toParsedMessages(chat!);
    expect(parsed[0]!.authorName).toBe('Денис Колесников');
  });
});

describe('группировка работает на данных из дампа', () => {
  it('склеивает два подряд идущих сообщения одного автора', async () => {
    const [chat] = await readDump(FIXTURE);
    const intro = toParsedMessages(chat!).filter((m) => m.threadId === 10);
    const groups = groupConsecutive(intro);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.rootMessageId).toBe(100);
    expect(groups[0]!.text).toContain('Южно-Сахалинск');
    expect(groups[0]!.text).toContain('от клиентов не отказываюсь');
  });

  it('не склеивает сообщения разных авторов', async () => {
    const [chat] = await readDump(FIXTURE);
    const work = toParsedMessages(chat!).filter((m) => m.threadId === 11);
    const groups = groupConsecutive(work);
    expect(groups).toHaveLength(2);
  });
});

describe('topicTitle', () => {
  it('возвращает название ветки — нужно для VIP, где это имя ученика', async () => {
    const [chat] = await readDump(FIXTURE);
    expect(topicTitle(chat!, 11)).toBe('SHOW CASE STUDIO');
    expect(topicTitle(chat!, 999)).toBeNull();
  });
});
