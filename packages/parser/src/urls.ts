/**
 * Извлечение адресов из текста сообщения.
 *
 * Детерминированно и без LLM: ссылки в тексте присутствуют буквально.
 * Отсекаются мессенджеры, соцсети и платформа курса — это контакты и
 * учебные материалы, а не работы учеников.
 */

const URL_RE = /https?:\/\/[^\s<>"'）)\]]+/gi;

const REPO_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];

/** Хосты, которые никогда не являются работой ученика. */
const NOT_A_WORK_HOSTS = [
  't.me',
  'telegram.me',
  'telegram.org',
  'wa.me',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'vk.com',
  'ai-education.kwiga.com',
  'kwiga.com',
  'zoom.us',
  'docs.google.com',
  'drive.google.com',
];

/** Убирает знаки препинания, прилипшие к концу ссылки в живом тексте. */
function trimTrailing(url: string): string {
  return url.replace(/[.,;:!?)\]}'"»]+$/, '');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export interface ExtractedUrls {
  /** Первая ссылка, похожая на живой проект ученика. */
  liveUrl: string | null;
  /** Первая ссылка на репозиторий. */
  repoUrl: string | null;
  /** Все найденные ссылки в порядке появления. */
  allUrls: string[];
}

export function extractUrls(text: string): ExtractedUrls {
  if (!text) return { liveUrl: null, repoUrl: null, allUrls: [] };

  const found = (text.match(URL_RE) ?? []).map(trimTrailing).filter(Boolean);
  const allUrls = [...new Set(found)];

  let liveUrl: string | null = null;
  let repoUrl: string | null = null;

  for (const url of allUrls) {
    const host = hostOf(url);
    if (!host) continue;
    if (REPO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      repoUrl ??= url;
      continue;
    }
    if (NOT_A_WORK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue;
    liveUrl ??= url;
  }

  return { liveUrl, repoUrl, allUrls };
}
