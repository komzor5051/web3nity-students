import { describe, it, expect } from 'vitest';
import { isPurpose, projectClassLabel, PURPOSE_LABEL, PURPOSE_ORDER, usesPurpose } from './catalog';

describe('purpose', () => {
  it('has a label for every purpose', () => {
    expect(PURPOSE_ORDER.map((k) => PURPOSE_LABEL[k])).toEqual([
      'Продажи и заявки',
      'Ответы клиентам',
      'Запись и заказы',
      'Контент и соцсети',
      'Документы и данные',
      'Обучение',
      'Личный помощник',
      'Другое',
    ]);
  });

  it('validates values against the list', () => {
    expect(isPurpose('sales')).toBe(true);
    expect(isPurpose('bot')).toBe(false);
    expect(isPurpose(null)).toBe(false);
  });

  it('uses purpose only for the assistants course', () => {
    expect(usesPurpose('assistants')).toBe(true);
    expect(usesPurpose('vibecoding')).toBe(false);
  });

  it('picks the label by course', () => {
    const p = { kind: 'bot' as const, purpose: 'support' as const };
    expect(projectClassLabel(p, 'assistants')).toBe('Ответы клиентам');
    expect(projectClassLabel(p, 'vibecoding')).toBe('Telegram-бот');
    expect(projectClassLabel({ kind: 'bot', purpose: null }, 'assistants')).toBeNull();
  });
});
