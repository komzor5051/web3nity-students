'use client';

import { useState } from 'react';
import { KIND_LABEL, KIND_ORDER, NONE, PURPOSE_LABEL, PURPOSE_ORDER, usesPurpose, type ProjectCardData } from '@/lib/catalog';
import { matchesTerms } from '@/lib/text';
import type { CourseId } from '@vibe/db/courses';
import { ProjectCard } from '@/lib/ui';
import { Results } from '../catalog-results';

export default function ProjectsCatalog({ items, course }: { items: ProjectCardData[]; course: CourseId }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const byPurpose = usesPurpose(course);

  const found = items.filter((p) => {
    const term = q.trim().toLowerCase();
    if (term && !matchesTerms([p.title, p.description, p.authorName].filter(Boolean).join(' ').toLowerCase(), term)) {
      return false;
    }
    const value = byPurpose ? p.purpose : p.kind;
    if (kind === NONE ? Boolean(value) : kind && value !== kind) return false;
    return true;
  });

  const labels: Record<string, string> = byPurpose ? PURPOSE_LABEL : KIND_LABEL;
  const order: string[] = byPurpose ? PURPOSE_ORDER : KIND_ORDER;
  const active = kind ? [kind === NONE ? (byPurpose ? 'Назначение не указано' : 'Тип не указан') : labels[kind]] : [];

  return (
    <>
      <div className="filters discovery">
        <input
          type="search"
          aria-label="Поиск по проектам"
          placeholder="Поиск по описанию: например, запись клиентов"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          data-simple="type"
          aria-label={byPurpose ? 'Назначение ассистента' : 'Тип инструмента'}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">{byPurpose ? 'Все назначения' : 'Все типы инструментов'}</option>
          {order.map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
          <option value={NONE}>{byPurpose ? 'Назначение не указано' : 'Тип не указан'}</option>
        </select>
      </div>
      <Results
        count={found.length}
        active={active}
        onReset={() => {
          setQ('');
          setKind('');
        }}
      />
      <div className="grid">
        {found.map((p) => (
          <ProjectCard key={p.id} p={p} course={course} />
        ))}
      </div>
      {found.length === 0 ? (
        <p className="demo">
          {items.length ? 'Ничего не найдено. Уберите одно из условий или сбросьте фильтры.' : 'Проектов пока нет. Добавьте первый.'}
        </p>
      ) : null}
    </>
  );
}
