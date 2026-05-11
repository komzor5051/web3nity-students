import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHtml } from '../src/html.js';
import { groupConsecutive, isLongPost } from '../src/group.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(__dirname, 'fixtures/sample.html'), 'utf8');

describe('parseHtml', () => {
  const messages = parseHtml(fixture);

  it('extracts all message blocks (excluding fixture wrappers)', () => {
    expect(messages.length).toBe(6);
  });

  it('marks service messages', () => {
    const service = messages.filter((m) => m.isService);
    expect(service).toHaveLength(1);
    expect(service[0]!.messageId).toBe(1);
  });

  it('parses author names and dates', () => {
    const m100 = messages.find((m) => m.messageId === 100)!;
    expect(m100.authorName).toBe('Иван Иванов');
    expect(m100.postedAt).toBe('2026-04-20T08:11:01+03:00');
    expect(m100.text).toContain('Меня зовут Иван');
    expect(m100.text).toContain('#обомне');
  });

  it('inherits author for joined blocks', () => {
    const m101 = messages.find((m) => m.messageId === 101)!;
    expect(m101.joined).toBe(true);
    expect(m101.authorName).toBe('Иван Иванов');
  });

  it('extracts photo media', () => {
    const m100 = messages.find((m) => m.messageId === 100)!;
    expect(m100.media).toHaveLength(1);
    expect(m100.media[0]).toMatchObject({
      type: 'image',
      path: 'photos/photo_2@20-04-2026_08-11-01.jpg',
      filename: 'photo_2@20-04-2026_08-11-01.jpg',
    });
  });

  it('extracts file media', () => {
    const m103 = messages.find((m) => m.messageId === 103)!;
    expect(m103.media).toHaveLength(1);
    expect(m103.media[0]!.type).toBe('file');
    expect(m103.media[0]!.path).toBe('files/portfolio.pdf');
  });

  it('parses replyToId from onclick', () => {
    const m102 = messages.find((m) => m.messageId === 102)!;
    expect(m102.replyToId).toBe(100);
  });

  it('preserves line breaks from <br>', () => {
    const m28 = messages.find((m) => m.messageId === 28)!;
    expect(m28.text).toContain('\n\n');
    expect(m28.text).toContain('Пишите');
  });
});

describe('groupConsecutive', () => {
  const messages = parseHtml(fixture);
  const groups = groupConsecutive(messages);

  it('skips service messages', () => {
    expect(groups.every((g) => g.authorName !== null)).toBe(true);
  });

  it('merges joined messages from same author', () => {
    const ivan = groups.find((g) => g.rootMessageId === 100)!;
    expect(ivan.messageIds).toEqual([100, 101]);
    expect(ivan.text).toContain('Меня зовут Иван');
    expect(ivan.text).toContain('Хобби: бег, шахматы');
  });

  it('does not merge across other authors', () => {
    const anna = groups.find((g) => g.authorName === 'Анна Петрова')!;
    expect(anna.messageIds).toEqual([102]);

    const ivanLater = groups.find((g) => g.rootMessageId === 103)!;
    expect(ivanLater.messageIds).toEqual([103]);
  });

  it('isLongPost flags substantial posts', () => {
    const ivan = groups.find((g) => g.rootMessageId === 100)!;
    expect(isLongPost(ivan)).toBe(true);
    const anna = groups.find((g) => g.authorName === 'Анна Петрова')!;
    expect(isLongPost(anna)).toBe(false);
  });
});
