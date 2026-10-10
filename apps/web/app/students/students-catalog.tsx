'use client';

import { useMemo, useState } from 'react';
import { NONE, REGIONS, STATUS_LABEL, STATUS_ORDER, type StudentCardData } from '@/lib/catalog';
import { matchesTerms } from '@/lib/text';
import { StudentCard } from '@/lib/ui';
import { Results } from '../catalog-results';

export default function StudentsCatalog({ items, spheres }: { items: StudentCardData[]; spheres: string[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sphere, setSphere] = useState('');
  const [region, setRegion] = useState('');

  const index = useMemo(
    () =>
      new Map(
        items.map((s) => [
          s.id,
          [s.name, s.niche, s.about, s.sphere, s.location, s.region, ...s.statuses.map((x) => STATUS_LABEL[x])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        ]),
      ),
    [items],
  );

  const found = items.filter((s) => {
    const term = q.trim().toLowerCase();
    if (term && !matchesTerms(index.get(s.id) ?? '', term)) return false;
    if (status === NONE ? s.statuses.length > 0 : status && !s.statuses.includes(status as never)) return false;
    if (sphere === NONE ? Boolean(s.sphere) : sphere && s.sphere !== sphere) return false;
    if (region === NONE ? Boolean(s.region) : region && s.region !== region) return false;
    return true;
  });

  const label = (v: string, map?: Record<string, string>) => (v === NONE ? 'Не указано' : (map?.[v] ?? v));
  const active = [label(status, STATUS_LABEL), label(sphere), label(region)].filter(Boolean);

  return (
    <>
      <div className="filters discovery">
        <input
          type="search"
          aria-label="Поиск по ученикам"
          placeholder="Имя, город, занятия или интересы"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Статус</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
          <option value={NONE}>Не указано</option>
        </select>
        <select aria-label="Сфера деятельности" value={sphere} onChange={(e) => setSphere(e.target.value)}>
          <option value="">Сфера деятельности</option>
          {spheres.map((s) => (
            <option key={s}>{s}</option>
          ))}
          <option value={NONE}>Не указано</option>
        </select>
        <select aria-label="Регион" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Все регионы</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
          <option value={NONE}>Не указано</option>
        </select>
      </div>
      <Results
        count={found.length}
        active={active}
        onReset={() => {
          setQ('');
          setStatus('');
          setSphere('');
          setRegion('');
        }}
      />
      <div className="grid">
        {found.map((s) => (
          <StudentCard key={s.id} s={s} />
        ))}
      </div>
      {found.length === 0 ? (
        <p className="demo">Никого не найдено. Уберите одно из условий или сбросьте фильтры.</p>
      ) : null}
    </>
  );
}
