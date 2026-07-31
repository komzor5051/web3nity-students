/**
 * Валидация ссылок, которые ученик сохраняет как href на публичной
 * странице работы (live_url, repo_url). Принимаем только http/https —
 * иначе можно сохранить javascript: или другую опасную схему, которая
 * потом станет кликабельным href в чужом браузере.
 */
export type UrlValidation = { ok: true; value: string | null } | { ok: false; error: string };

export function validateHttpUrl(raw: string | null, label: string): UrlValidation {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return { ok: true, value: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `${label}: похоже, это не ссылка.` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `${label}: разрешены только ссылки http:// или https://.` };
  }

  return { ok: true, value: trimmed };
}
