import { describe, it, expect } from 'vitest';
import { classifyByTopic, cohortOf, CHAT_CONFIGS } from '../src/topics.js';

const MAIN = -1004353204500;
const TWO_MONTH = -1004413372752;
const VIP = -1003966609206;

describe('classifyByTopic', () => {
  it('SHOW CASE STUDIO основного чата — это работы', () => {
    expect(classifyByTopic(MAIN, 11)).toBe('work');
  });

  it('Нетворкинг — это представления', () => {
    expect(classifyByTopic(MAIN, 10)).toBe('intro');
  });

  it('ветки недель — это вопросы по урокам', () => {
    for (const t of [14, 15, 16, 17]) {
      expect(classifyByTopic(MAIN, t)).toBe('qa');
    }
  });

  it('новостная ветка игнорируется', () => {
    expect(classifyByTopic(MAIN, 2)).toBe('ignore');
    expect(classifyByTopic(VIP, 2)).toBe('ignore');
  });

  it('в чате 2 month SHOW CASE STUDIO имеет другой topic_id', () => {
    expect(classifyByTopic(TWO_MONTH, 20)).toBe('work');
    expect(classifyByTopic(TWO_MONTH, 11)).not.toBe('work');
  });

  it('любая ветка VIP кроме новостей — персональная', () => {
    expect(classifyByTopic(VIP, 10)).toBe('vip_personal');
    expect(classifyByTopic(VIP, 45)).toBe('vip_personal');
  });

  it('сообщение вне веток попадает в chat, а не в work', () => {
    expect(classifyByTopic(MAIN, null)).toBe('chat');
  });

  it('незнакомая ветка не считается работой', () => {
    expect(classifyByTopic(MAIN, 999)).toBe('chat');
  });

  it('служебная ветка General игнорируется во всех чатах', () => {
    // Она называется именем чата. Без этого правила в VIP она стала бы
    // «учеником» по имени «VIBECODING | VIP».
    expect(classifyByTopic(MAIN, 1)).toBe('ignore');
    expect(classifyByTopic(TWO_MONTH, 1)).toBe('ignore');
    expect(classifyByTopic(VIP, 1)).toBe('ignore');
  });

  it('неизвестный чат бросает ошибку, а не молча возвращает chat', () => {
    expect(() => classifyByTopic(-1, 1)).toThrow(/неизвестный чат/i);
  });
});

describe('cohortOf', () => {
  it('каждому чату соответствует своя когорта', () => {
    expect(cohortOf(MAIN)).toBe('vibecoding-main');
    expect(cohortOf(TWO_MONTH)).toBe('vibecoding-2month');
    expect(cohortOf(VIP)).toBe('vibecoding-vip');
  });

  it('когорты уникальны', () => {
    const cohorts = CHAT_CONFIGS.map((c) => c.cohort);
    expect(new Set(cohorts).size).toBe(cohorts.length);
  });
});
