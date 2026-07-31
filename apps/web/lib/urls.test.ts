import { describe, it, expect } from 'vitest';
import { validateHttpUrl } from './urls';

describe('validateHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(validateHttpUrl('https://example.com', 'Ссылка')).toEqual({
      ok: true,
      value: 'https://example.com',
    });
    expect(validateHttpUrl('http://example.com', 'Ссылка')).toEqual({
      ok: true,
      value: 'http://example.com',
    });
  });

  it('treats empty or whitespace-only input as null (not an error)', () => {
    expect(validateHttpUrl('', 'Ссылка')).toEqual({ ok: true, value: null });
    expect(validateHttpUrl('   ', 'Ссылка')).toEqual({ ok: true, value: null });
    expect(validateHttpUrl(null, 'Ссылка')).toEqual({ ok: true, value: null });
  });

  it('rejects javascript: URLs', () => {
    const result = validateHttpUrl('javascript:alert(1)', 'Ссылка на сайт');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/http/);
  });

  it('rejects data: and other non-http schemes', () => {
    expect(validateHttpUrl('data:text/html,hi', 'Ссылка').ok).toBe(false);
    expect(validateHttpUrl('ftp://example.com', 'Ссылка').ok).toBe(false);
    expect(validateHttpUrl('vbscript:msgbox(1)', 'Ссылка').ok).toBe(false);
  });

  it('rejects strings that are not valid URLs at all', () => {
    expect(validateHttpUrl('not a url', 'Ссылка').ok).toBe(false);
  });
});
