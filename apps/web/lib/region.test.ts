import { describe, it, expect } from 'vitest';
import { resolveRegion } from './region';

describe('resolveRegion', () => {
  it('maps a plain city', () => {
    expect(resolveRegion('Москва', null)).toBe('СНГ');
    expect(resolveRegion('Минск', 'Беларусь')).toBe('СНГ');
    expect(resolveRegion('Мадрид', 'Испания')).toBe('Европа');
  });

  it('prefers city over a wrong/hallucinated country', () => {
    // LLM выставил «Аргентина», но человек живёт в Москве — это СНГ, не Америка.
    expect(resolveRegion('Москва', 'Аргентина')).toBe('СНГ');
    expect(resolveRegion('Москва', 'Армения')).toBe('СНГ');
  });

  it('falls back to country when city is empty or unknown', () => {
    expect(resolveRegion(null, 'Германия')).toBe('Европа');
    expect(resolveRegion(null, 'Израиль')).toBe('Ближний Восток');
    expect(resolveRegion(null, 'Вьетнам')).toBe('Азия');
    expect(resolveRegion(null, 'Мексика')).toBe('Америка');
  });

  it('handles multi-place strings by taking the first resolvable token', () => {
    expect(resolveRegion('Дубай/Москва/Гуанчжоу', null)).toBe('Ближний Восток');
    expect(resolveRegion('Псков, Дубай, Эр-Рияд', 'Россия, ОАЭ, Саудовская Аравия')).toBe('СНГ');
    expect(resolveRegion('Шэньчжэнь/Шанхай', 'Китай')).toBe('Азия');
    expect(resolveRegion('Москва/Красногорск', null)).toBe('СНГ');
  });

  it('covers countries that were missing from the old hardcoded map', () => {
    expect(resolveRegion('Пловдив', 'Болгария')).toBe('Европа');
    expect(resolveRegion(null, 'Великобритания')).toBe('Европа');
    expect(resolveRegion(null, 'Бельгия')).toBe('Европа');
  });

  it('resolves cities without a country (the common dirty case)', () => {
    expect(resolveRegion('Екатеринбург', null)).toBe('СНГ');
    expect(resolveRegion('Хабаровск', null)).toBe('СНГ');
    expect(resolveRegion('Таллин', null)).toBe('Европа');
    expect(resolveRegion('Сиэтл', null)).toBe('Америка');
  });

  it('is case- and ё-insensitive', () => {
    expect(resolveRegion('москва', null)).toBe('СНГ');
    expect(resolveRegion('  МОСКВА  ', null)).toBe('СНГ');
  });

  it('returns null when nothing is known', () => {
    expect(resolveRegion(null, null)).toBeNull();
    expect(resolveRegion('Атлантида', 'Нарния')).toBeNull();
  });
});
