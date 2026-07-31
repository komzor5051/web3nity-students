import { describe, it, expect } from 'vitest';
import {
  assertUrlSafeToFetch,
  isUrlSafeToFetch,
  assertConnectedAddressSafe,
  assertUrlShapeSafe,
  UnsafeUrlError,
} from '../url-safety.js';

const noDnsCalls = async (): Promise<never> => {
  throw new Error('DNS lookup should not be called for literal IPs');
};

describe('assertUrlSafeToFetch — схемы', () => {
  it('пропускает http и https', async () => {
    await expect(assertUrlSafeToFetch('http://example.com')).resolves.toBeUndefined();
    await expect(assertUrlSafeToFetch('https://example.com')).resolves.toBeUndefined();
  });

  it('отклоняет остальные схемы', async () => {
    await expect(assertUrlSafeToFetch('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('ftp://example.com')).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('data:text/plain;base64,aGk=')).rejects.toThrow(UnsafeUrlError);
  });

  it('отклоняет неразбираемый URL', async () => {
    await expect(assertUrlSafeToFetch('не url вообще')).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertUrlSafeToFetch — localhost', () => {
  it('отклоняет localhost', async () => {
    await expect(assertUrlSafeToFetch('http://localhost:3000', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://LOCALHOST', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertUrlSafeToFetch — запрещённые диапазоны IPv4', () => {
  it('127.0.0.0/8 (loopback)', async () => {
    await expect(assertUrlSafeToFetch('http://127.0.0.1', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://127.255.255.255', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });

  it('10.0.0.0/8 (private)', async () => {
    await expect(assertUrlSafeToFetch('http://10.0.0.5', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://10.255.255.255', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });

  it('172.16.0.0/12 (private) — с проверкой границ диапазона', async () => {
    await expect(assertUrlSafeToFetch('http://172.16.0.1', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://172.31.255.255', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    // 172.32.0.0 уже вне /12 — не должен блокироваться.
    await expect(assertUrlSafeToFetch('http://172.32.0.1', noDnsCalls)).resolves.toBeUndefined();
    // 172.15.255.255 тоже вне диапазона.
    await expect(assertUrlSafeToFetch('http://172.15.255.255', noDnsCalls)).resolves.toBeUndefined();
  });

  it('192.168.0.0/16 (private)', async () => {
    await expect(assertUrlSafeToFetch('http://192.168.1.1', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://192.168.255.255', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });

  it('169.254.0.0/16 (link-local, включая cloud metadata)', async () => {
    await expect(assertUrlSafeToFetch('http://169.254.169.254', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
    await expect(assertUrlSafeToFetch('http://169.254.0.1', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });

  it('пропускает публичные IPv4-адреса', async () => {
    await expect(assertUrlSafeToFetch('http://8.8.8.8', noDnsCalls)).resolves.toBeUndefined();
    await expect(assertUrlSafeToFetch('http://93.184.216.34', noDnsCalls)).resolves.toBeUndefined();
  });
});

describe('assertUrlSafeToFetch — IPv6', () => {
  it('отклоняет ::1', async () => {
    await expect(assertUrlSafeToFetch('http://[::1]', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });

  it('отклоняет IPv4-mapped loopback ::ffff:127.0.0.1 — известный обход фильтра', async () => {
    await expect(assertUrlSafeToFetch('http://[::ffff:127.0.0.1]', noDnsCalls)).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertUrlSafeToFetch — доменные имена, резолвящиеся в запрещённые диапазоны', () => {
  it('блокирует хост, который резолвится в loopback', async () => {
    const lookup = async () => [{ address: '127.0.0.1', family: 4 }];
    await expect(assertUrlSafeToFetch('http://evil.example.com', lookup)).rejects.toThrow(UnsafeUrlError);
  });

  it('блокирует хост, который резолвится в приватный диапазон', async () => {
    const lookup = async () => [{ address: '10.1.2.3', family: 4 }];
    await expect(assertUrlSafeToFetch('http://internal.example.com', lookup)).rejects.toThrow(UnsafeUrlError);
  });

  it('пропускает хост, резолвящийся в публичный адрес', async () => {
    const lookup = async () => [{ address: '203.0.113.10', family: 4 }];
    await expect(assertUrlSafeToFetch('http://student-site.example.com', lookup)).resolves.toBeUndefined();
  });

  it('блокирует, если резолвится в диапазон хотя бы один из адресов', async () => {
    const lookup = async () => [
      { address: '203.0.113.10', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ];
    await expect(assertUrlSafeToFetch('http://mixed.example.com', lookup)).rejects.toThrow(UnsafeUrlError);
  });

  it('отклоняет, если DNS не резолвится', async () => {
    const lookup = async (): Promise<never> => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertUrlSafeToFetch('http://nowhere.invalid', lookup)).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertConnectedAddressSafe — проверка фактического адреса соединения', () => {
  it('пропускает публичный адрес', () => {
    expect(() => assertConnectedAddressSafe('8.8.8.8')).not.toThrow();
    expect(() => assertConnectedAddressSafe('93.184.216.34')).not.toThrow();
  });

  it('отклоняет 127.0.0.0/8', () => {
    expect(() => assertConnectedAddressSafe('127.0.0.1')).toThrow(UnsafeUrlError);
    expect(() => assertConnectedAddressSafe('127.255.255.255')).toThrow(UnsafeUrlError);
  });

  it('отклоняет 10.0.0.0/8', () => {
    expect(() => assertConnectedAddressSafe('10.0.0.5')).toThrow(UnsafeUrlError);
  });

  it('отклоняет 172.16.0.0/12 с проверкой границ', () => {
    expect(() => assertConnectedAddressSafe('172.16.0.1')).toThrow(UnsafeUrlError);
    expect(() => assertConnectedAddressSafe('172.31.255.255')).toThrow(UnsafeUrlError);
    expect(() => assertConnectedAddressSafe('172.32.0.1')).not.toThrow();
  });

  it('отклоняет 192.168.0.0/16', () => {
    expect(() => assertConnectedAddressSafe('192.168.1.1')).toThrow(UnsafeUrlError);
  });

  it('отклоняет 169.254.0.0/16 (в т.ч. cloud metadata)', () => {
    expect(() => assertConnectedAddressSafe('169.254.169.254')).toThrow(UnsafeUrlError);
  });

  it('отклоняет ::1', () => {
    expect(() => assertConnectedAddressSafe('::1')).toThrow(UnsafeUrlError);
  });

  it('отклоняет IPv4-mapped loopback', () => {
    expect(() => assertConnectedAddressSafe('::ffff:127.0.0.1')).toThrow(UnsafeUrlError);
  });

  it('ловит гонку DNS-подмены: хост прошёл предварительную проверку, но реальный адрес соединения приватный', () => {
    // Симулируем сценарий: assertUrlSafeToFetch на этапе резолвинга видел
    // публичный адрес, но к моменту TCP-соединения DNS-ответ сменился.
    const dnsAtCheckTime = '203.0.113.10'; // публичный — прошёл бы assertUrlSafeToFetch
    const dnsAtConnectTime = '169.254.169.254'; // приватный — то, к чему реально подключился браузер
    expect(() => assertConnectedAddressSafe(dnsAtCheckTime)).not.toThrow();
    expect(() => assertConnectedAddressSafe(dnsAtConnectTime)).toThrow(UnsafeUrlError);
  });
});

describe('assertUrlShapeSafe — итоговый URL после редиректов', () => {
  it('пропускает http/https с обычным хостом', () => {
    expect(() => assertUrlShapeSafe('https://student-site.example.com/page')).not.toThrow();
  });

  it('легитимные редиректы (apex -> www, http -> https) не блокируются', () => {
    expect(() => assertUrlShapeSafe('https://www.student-site.example.com/')).not.toThrow();
  });

  it('отклоняет смену схемы на нежелательную после редиректа', () => {
    expect(() => assertUrlShapeSafe('file:///etc/passwd')).toThrow(UnsafeUrlError);
  });

  it('отклоняет редирект на localhost', () => {
    expect(() => assertUrlShapeSafe('http://localhost:9000/')).toThrow(UnsafeUrlError);
  });

  it('отклоняет редирект на IP из запрещённого диапазона', () => {
    expect(() => assertUrlShapeSafe('http://169.254.169.254/latest/meta-data')).toThrow(UnsafeUrlError);
  });
});

describe('isUrlSafeToFetch', () => {
  it('возвращает false вместо исключения', async () => {
    expect(await isUrlSafeToFetch('http://127.0.0.1', noDnsCalls)).toBe(false);
  });

  it('возвращает true для безопасного адреса', async () => {
    expect(await isUrlSafeToFetch('http://8.8.8.8', noDnsCalls)).toBe(true);
  });
});
