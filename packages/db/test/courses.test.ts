import { describe, it, expect } from 'vitest';
import { COURSES, COURSE_IDS, courseOfChat, coursesOfChats, getCourse, isCourseId } from '../src/courses.js';

describe('реестр курсов', () => {
  it('содержит два курса, vibecoding первым', () => {
    expect(COURSE_IDS).toEqual(['vibecoding', 'assistants']);
    expect(COURSES.map((c) => c.title)).toEqual(['Вайбкодинг', 'AI-ассистенты']);
  });

  it('один чат принадлежит ровно одному курсу', () => {
    const all = COURSES.flatMap((c) => c.chatIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(6);
  });

  it('isCourseId / getCourse пропускают только известные курсы', () => {
    expect(isCourseId('assistants')).toBe(true);
    expect(isCourseId('students')).toBe(false);
    expect(isCourseId(undefined)).toBe(false);
    expect(getCourse('vibecoding')?.id).toBe('vibecoding');
    expect(getCourse('nope')).toBeNull();
    // прототипные ключи не должны проходить как курсы
    expect(getCourse('constructor')).toBeNull();
    expect(isCourseId('toString')).toBe(false);
  });

  it('courseOfChat определяет курс по чату', () => {
    expect(courseOfChat(-1004353204500)).toBe('vibecoding');
    expect(courseOfChat(-1003709866237)).toBe('vibecoding');
    expect(courseOfChat(-1003764026898)).toBe('assistants');
    expect(courseOfChat(-1003803830627)).toBe('assistants');
    expect(courseOfChat(-1)).toBeNull();
  });

  it('coursesOfChats: человек в чатах обоих курсов получает оба, в порядке реестра', () => {
    expect(coursesOfChats([-1003764026898, -1004353204500])).toEqual(['vibecoding', 'assistants']);
    expect(coursesOfChats([-1003803830627])).toEqual(['assistants']);
    expect(coursesOfChats([])).toEqual([]);
  });
});
