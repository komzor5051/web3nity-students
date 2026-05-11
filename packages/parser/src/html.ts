import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Element } from 'domhandler';
import type { ParsedMedia, ParsedMessage } from './types.js';

/**
 * Parse all messages*.html files from a Telegram export directory.
 * Joined blocks inherit author from the previous message.
 */
export async function parseExportDir(exportDir: string): Promise<ParsedMessage[]> {
  const entries = await readdir(exportDir);
  const htmlFiles = entries
    .filter((f) => /^messages\d*\.html$/.test(f))
    .sort((a, b) => htmlFileIndex(a) - htmlFileIndex(b));

  const all: ParsedMessage[] = [];
  let lastAuthor: string | null = null;

  for (const file of htmlFiles) {
    const html = await readFile(path.join(exportDir, file), 'utf8');
    const messages = parseHtml(html, lastAuthor);
    if (messages.length > 0) {
      lastAuthor = messages[messages.length - 1]!.authorName ?? lastAuthor;
    }
    all.push(...messages);
  }
  return all;
}

function htmlFileIndex(name: string): number {
  const m = /^messages(\d*)\.html$/.exec(name);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return m[1] ? parseInt(m[1], 10) : 1;
}

export function parseHtml(html: string, inheritedAuthor: string | null = null): ParsedMessage[] {
  const $ = load(html);
  const result: ParsedMessage[] = [];
  let lastAuthor = inheritedAuthor;

  $('div.message').each((_, el) => {
    const $msg = $(el);
    const idAttr = $msg.attr('id') ?? '';
    const m = /^message(-?\d+)$/.exec(idAttr);
    if (!m) return;
    const messageId = parseInt(m[1]!, 10);
    const isService = $msg.hasClass('service');
    const joined = $msg.hasClass('joined');

    let authorName: string | null = null;
    const fromName = $msg.find('> div.body > div.from_name').first();
    if (fromName.length) {
      authorName = clean(fromName.text());
    } else if (joined) {
      authorName = lastAuthor;
    }
    if (authorName) lastAuthor = authorName;

    const postedAt = parseDate($msg.find('> div.body > div.pull_right.date').attr('title'));
    const text = extractText($msg);
    const media = extractMedia($, $msg);
    const replyToId = parseReplyTo($msg);

    result.push({
      messageId,
      threadId: null,
      authorName,
      postedAt,
      text,
      media,
      replyToId,
      isService,
      joined,
    });
  });

  return result;
}

function extractText($msg: Cheerio<Element>): string {
  const $text = $msg.find('> div.body > div.text').first();
  if (!$text.length) return '';
  $text.find('br').replaceWith('\n');
  return clean($text.text());
}

function extractMedia($: CheerioAPI, $msg: Cheerio<Element>): ParsedMedia[] {
  const media: ParsedMedia[] = [];

  $msg.find('a.photo_wrap').each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;
    media.push({ type: 'image', path: href, filename: path.basename(href) });
  });

  $msg.find('a.media.block_link.media_file').each((_, a) => {
    const href = $(a).attr('href');
    if (!href) return;
    const filename = path.basename(href);
    const isVideo = /\.(mp4|mov|webm)$/i.test(href);
    media.push({
      type: isVideo ? 'video' : 'file',
      path: href,
      filename,
    });
  });

  $msg.find('a').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (href.startsWith('video_files/')) {
      media.push({ type: 'video', path: href, filename: path.basename(href) });
    } else if (href.startsWith('stickers/')) {
      media.push({ type: 'sticker', path: href, filename: path.basename(href) });
    } else if (href.startsWith('voice_messages/')) {
      media.push({ type: 'voice', path: href, filename: path.basename(href) });
    }
  });

  const seen = new Set<string>();
  return media.filter((m) => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  });
}

function parseReplyTo($msg: Cheerio<Element>): number | null {
  const a = $msg.find('> div.body > div.reply_to a').first();
  if (!a.length) return null;
  const onclick = a.attr('onclick') ?? '';
  const m = /GoToMessage\((-?\d+)\)/.exec(onclick);
  if (m) return parseInt(m[1]!, 10);
  const href = a.attr('href') ?? '';
  const m2 = /go_to_message(-?\d+)/.exec(href);
  return m2 ? parseInt(m2[1]!, 10) : null;
}

function parseDate(title: string | undefined): string | null {
  if (!title) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+UTC([+-]\d{2}:\d{2})$/.exec(title);
  if (!m) return null;
  const [, dd, mm, yyyy, h, min, s, tz] = m;
  return `${yyyy}-${mm}-${dd}T${h}:${min}:${s}${tz}`;
}

function clean(s: string): string {
  return s.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
