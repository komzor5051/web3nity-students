'use client';

import { useState } from 'react';
import { KIND_LABEL, KIND_ORDER, NONE, type ProjectCardData } from '@/lib/catalog';
import { matchesTerms } from '@/lib/text';
import { ProjectCard } from '@/lib/ui';
import { Results } from '../catalog-results';

export default function ProjectsCatalog({ items }: { items: ProjectCardData[] }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');

  const found = items.filter((p) => {
    const term = q.trim().toLowerCase();
    if (term && !matchesTerms([p.title, p.description, p.authorName].filter(Boolean).join(' ').toLowerCase(), term)) {
      return false;
    }
    if (kind === NONE ? Boolean(p.kind) : kind && p.kind !== kind) return false;
    return true;
  });

  const active = kind ? [kind === NONE ? 'Тип не указан' : KIND_LABEL[kind as keyof typeof KIND_LABEL]] : [];

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
        <select data-simple="type" aria-label="Тип инструмента" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Все типы инструментов</option>
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
          <option value={NONE}>Тип не указан</option>
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
          <ProjectCard key={p.id} p={p} />
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
