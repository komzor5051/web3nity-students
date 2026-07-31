/**
 * Проверка URL перед тем, как его откроет Playwright.
 *
 * live_url приходит из пользовательского ввода и из чата — без проверки
 * скриншотер превращается в инструмент обхода сетевого периметра (SSRF):
 * можно попросить его открыть внутренний адрес, cloud-metadata endpoint
 * (169.254.169.254) или localhost-сервис.
 *
 * Разрешены только http/https. Запрещены localhost, loopback, private и
 * link-local диапазоны — и доменные имена, которые в них резолвятся.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {}

export interface DnsRecord {
  address: string;
  family: number;
}

export type LookupFn = (hostname: string) => Promise<DnsRecord[]>;

async function defaultLookup(hostname: string): Promise<DnsRecord[]> {
  const result = await dnsLookup(hostname, { all: true });
  return result as DnsRecord[];
}

interface V4Range {
  base: number;
  bits: number;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function range(cidrBase: string, bits: number): V4Range {
  const base = ipv4ToInt(cidrBase);
  if (base === null) throw new Error(`bad range literal: ${cidrBase}`);
  return { base, bits };
}

/** Диапазоны из требования безопасности задачи 9, дословно. */
const BLOCKED_V4_RANGES: V4Range[] = [
  range('127.0.0.0', 8), // loopback
  range('10.0.0.0', 8), // private
  range('172.16.0.0', 12), // private
  range('192.168.0.0', 16), // private
  range('169.254.0.0', 16), // link-local, включая cloud metadata (169.254.169.254)
];

function ipv4InBlockedRange(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return BLOCKED_V4_RANGES.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (base & mask);
  });
}

/**
 * IPv4-mapped IPv6 (::ffff:127.0.0.1) — известный способ обойти фильтр по
 * хосту. Node нормализует такой литерал в URL в hex-форму (::ffff:7f00:1),
 * так что распознаём обе записи.
 */
function mappedV4(ip: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  if (dotted) return dotted[1]!;

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!hex) return null;
  const hi = parseInt(hex[1]!, 16);
  const lo = parseInt(hex[2]!, 16);
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
}

const V6_LOOPBACK = new Set(['::1', '0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:0000:0000:0001']);

function isBlockedAddress(address: string): boolean {
  const mapped = mappedV4(address);
  if (mapped) return ipv4InBlockedRange(mapped);
  if (address.includes(':')) return V6_LOOPBACK.has(address.toLowerCase());
  return ipv4InBlockedRange(address);
}

/**
 * Проверяет фактический адрес, к которому браузер УЖЕ подключился
 * (`Response.serverAddr()` в Playwright, после `page.goto`).
 *
 * Это решающая проверка, а не дополнительная: между предварительной
 * проверкой хоста (assertUrlSafeToFetch, до перехода) и реальным TCP-
 * соединением DNS-ответ может смениться — публичный адрес на этапе проверки,
 * приватный на этапе подключения (rebinding). Проверка по хосту такую
 * подмену не увидит в принципе, только проверка по факту соединения.
 *
 * Переиспользует ту же логику диапазонов (isBlockedAddress), что и
 * предварительная проверка — не дублирует список диапазонов.
 */
export function assertConnectedAddressSafe(address: string): void {
  if (isBlockedAddress(address)) {
    throw new UnsafeUrlError(`браузер подключился к запрещённому адресу: ${address}`);
  }
}

/**
 * Проверяет схему и хост URL без резолвинга DNS — форма без содержимого.
 * Используется дважды: как часть assertUrlSafeToFetch (для URL до перехода)
 * и отдельно для итогового URL после редиректов (page.url()/response.url()),
 * где резолвить домен уже поздно — важен URL, а не факт подключения (это
 * закрывает assertConnectedAddressSafe).
 */
export function assertUrlShapeSafe(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`не удалось разобрать URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(`запрещённая схема: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost') {
    throw new UnsafeUrlError('localhost запрещён');
  }
  if (isBlockedAddress(hostname)) {
    throw new UnsafeUrlError(`адрес в запрещённом диапазоне: ${hostname}`);
  }

  return parsed;
}

/**
 * Бросает UnsafeUrlError, если URL нельзя безопасно открыть в браузере.
 * Для доменных имён резолвит хост и проверяет реальные адреса — иначе
 * `evil.example.com`, указывающий на 127.0.0.1, обошёл бы фильтр.
 *
 * Это дешёвая предварительная проверка ДО перехода. Она не заменяет
 * assertConnectedAddressSafe после page.goto — между этой проверкой и
 * реальным соединением DNS-ответ может смениться (см. её докстринг).
 */
export async function assertUrlSafeToFetch(rawUrl: string, lookup: LookupFn = defaultLookup): Promise<void> {
  const parsed = assertUrlShapeSafe(rawUrl);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (isIP(hostname) === 0) {
    // Не литеральный IP — доменное имя. Резолвим и проверяем адреса,
    // на которые оно реально указывает.
    let records: DnsRecord[];
    try {
      records = await lookup(hostname);
    } catch {
      throw new UnsafeUrlError(`не удалось резолвить хост: ${hostname}`);
    }
    for (const r of records) {
      if (isBlockedAddress(r.address)) {
        throw new UnsafeUrlError(`${hostname} резолвится в запрещённый адрес ${r.address}`);
      }
    }
  }
}

export async function isUrlSafeToFetch(rawUrl: string, lookup: LookupFn = defaultLookup): Promise<boolean> {
  try {
    await assertUrlSafeToFetch(rawUrl, lookup);
    return true;
  } catch (e) {
    if (e instanceof UnsafeUrlError) return false;
    throw e;
  }
}
