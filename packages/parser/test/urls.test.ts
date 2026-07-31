import { describe, it, expect } from 'vitest';
import { extractUrls } from '../src/urls.js';

describe('extractUrls', () => {
  it('находит одиночную ссылку на сайт', () => {
    const r = extractUrls('Готово, вот мой проект https://www.hard-iron.ru посмотрите');
    expect(r.liveUrl).toBe('https://www.hard-iron.ru');
    expect(r.repoUrl).toBeNull();
  });

  it('различает репозиторий и живой сайт', () => {
    const r = extractUrls('Сайт https://kai.kometta.ru код https://github.com/user/repo');
    expect(r.liveUrl).toBe('https://kai.kometta.ru');
    expect(r.repoUrl).toBe('https://github.com/user/repo');
  });

  it('считает репозиториями github, gitlab и bitbucket', () => {
    expect(extractUrls('https://gitlab.com/a/b').repoUrl).toBe('https://gitlab.com/a/b');
    expect(extractUrls('https://bitbucket.org/a/b').repoUrl).toBe('https://bitbucket.org/a/b');
  });

  it('не принимает ссылку на телеграм за сайт проекта', () => {
    const r = extractUrls('пишите мне https://t.me/vladlyamin');
    expect(r.liveUrl).toBeNull();
  });

  it('игнорирует ссылки на платформу курса', () => {
    const r = extractUrls('урок тут https://ai-education.kwiga.com/courses/vibe-coding/');
    expect(r.liveUrl).toBeNull();
  });

  it('отрезает знаки препинания на конце', () => {
    expect(extractUrls('смотрите https://example.com.').liveUrl).toBe('https://example.com');
    expect(extractUrls('вот (https://example.com)').liveUrl).toBe('https://example.com');
  });

  it('берёт первую ссылку, если сайтов несколько', () => {
    const r = extractUrls('https://one.ru и ещё https://two.ru');
    expect(r.liveUrl).toBe('https://one.ru');
    expect(r.allUrls).toEqual(['https://one.ru', 'https://two.ru']);
  });

  it('пустой текст не ломает', () => {
    expect(extractUrls('')).toEqual({ liveUrl: null, repoUrl: null, allUrls: [] });
  });

  it('текст без ссылок даёт пустой результат', () => {
    expect(extractUrls('Просто рассказываю как дела').liveUrl).toBeNull();
  });
});
