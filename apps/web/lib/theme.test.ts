import { describe, expect, it } from 'vitest';
import { switchPath, themeOfPath } from './theme';

describe('themeOfPath', () => {
  it('тема по курсу в пути', () => {
    expect(themeOfPath('/vibecoding/students')).toBe('vibe');
    expect(themeOfPath('/assistants')).toBe('assistants');
  });
  it('вне курса нейтральная', () => {
    expect(themeOfPath('/login')).toBe('neutral');
    expect(themeOfPath('/')).toBe('neutral');
    expect(themeOfPath('/nope/x')).toBe('neutral');
  });
});

describe('switchPath', () => {
  it('сохраняет тип страницы', () => {
    expect(switchPath('/vibecoding/students', 'assistants')).toBe('/assistants/students');
    expect(switchPath('/vibecoding/projects', 'assistants')).toBe('/assistants/projects');
    expect(switchPath('/vibecoding/profile', 'assistants')).toBe('/assistants/profile');
    expect(switchPath('/vibecoding/profile/edit', 'assistants')).toBe('/assistants/profile/edit');
    expect(switchPath('/vibecoding', 'assistants')).toBe('/assistants');
  });
  it('страницы человека и проекта ведут в каталог', () => {
    expect(switchPath('/vibecoding/s/ivan-1', 'assistants')).toBe('/assistants/students');
    expect(switchPath('/vibecoding/w/abc', 'assistants')).toBe('/assistants/projects');
    expect(switchPath('/vibecoding/profile/projects/abc', 'assistants')).toBe('/assistants/profile');
  });
});
