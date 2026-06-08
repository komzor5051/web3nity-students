'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { REGION_OPTS } from '@/lib/region';

export type DirItem = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  region: string | null;
  niche: string | null;
  sphere: string | null;
  bio: string | null;
  goal: string | null;
  status: 'looking_for_clients' | 'looking_for_partners' | 'just_learning' | null;
  telegram: string | null;
  avatarColor: string;
  avatarUrl: string | null;
};

type StatusKey = 'all' | 'learning' | 'cofounder' | 'client' | 'none';

const STATUS_OPTS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'learning', label: 'Учусь' },
  { key: 'cofounder', label: 'Ищу партнёров' },
  { key: 'client', label: 'Ищу клиентов' },
  { key: 'none', label: 'Без статуса' },
];

function statusKey(s: DirItem['status']): 'learning' | 'cofounder' | 'client' | null {
  if (s === 'just_learning') return 'learning';
  if (s === 'looking_for_partners') return 'cofounder';
  if (s === 'looking_for_clients') return 'client';
  return null;
}

function statusText(s: DirItem['status']): string {
  if (s === 'just_learning') return 'Учусь';
  if (s === 'looking_for_partners') return 'Ищу партнёров';
  if (s === 'looking_for_clients') return 'Ищу клиентов';
  return '—';
}

function statusColor(s: DirItem['status']): { dot: string; text: string } {
  const k = statusKey(s);
  if (k === 'learning') return { dot: 'bg-green', text: 'text-green' };
  if (k === 'cofounder') return { dot: 'bg-purple', text: 'text-purple' };
  if (k === 'client') return { dot: 'bg-blue', text: 'text-blue' };
  return { dot: 'bg-text3', text: 'text-text3' };
}

export default function Directory({
  items,
  myId,
  recommendations,
}: {
  items: DirItem[];
  myId: string | null;
  recommendations: { item: DirItem; reason: string | null }[];
}) {
  const [status, setStatus] = useState<StatusKey>('all');
  const [sphere, setSphere] = useState<string>('all');
  const [region, setRegion] = useState<string>('Все');
  const [q, setQ] = useState<string>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [recsOpen, setRecsOpen] = useState(false);

  const spheres = useMemo(() => {
    // Только короткие и реально общие категории — длинные описательные «сферы»
    // (вроде «мастер цигун» или «продажа недвижимости под ВНЖ») как фильтр
    // бесполезны: у каждого человека своя, искать по ним невозможно.
    const counts = new Map<string, number>();
    for (const i of items) {
      if (!i.sphere) continue;
      if (i.sphere.length > 30) continue;
      counts.set(i.sphere, (counts.get(i.sphere) ?? 0) + 1);
    }
    const shared = Array.from(counts.entries())
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([s]) => s);
    return ['all', ...shared];
  }, [items]);

  const stats = useMemo(() => {
    const countries = new Set(items.map((i) => i.country).filter(Boolean) as string[]);
    const set = new Set(items.map((i) => i.sphere).filter(Boolean) as string[]);
    return { total: items.length, countries: countries.size, spheres: set.size };
  }, [items]);

  const term = q.trim().toLowerCase();

  const okStatus = (i: DirItem) => {
    if (status === 'all') return true;
    const k = statusKey(i.status);
    return status === 'none' ? k === null : k === status;
  };
  const okSphere = (i: DirItem) => sphere === 'all' || i.sphere === sphere;
  const okRegion = (i: DirItem) => region === 'Все' || i.region === region;
  const okSearch = (i: DirItem) => {
    if (!term) return true;
    const hay = [i.name, i.niche, i.sphere, i.city, i.country, i.bio]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(term);
  };

  // Фасетные счётчики: для каждого фильтра учитываем все ОСТАЛЬНЫЕ активные
  // фильтры, но не сам фильтр (иначе у активного чипа всегда стоял бы его же
  // размер). Так цифры всегда отражают, сколько найдётся при таком выборе.
  const statusCounts = useMemo(() => {
    const c: Record<StatusKey, number> = { all: 0, learning: 0, cofounder: 0, client: 0, none: 0 };
    for (const i of items) {
      if (!okSphere(i) || !okRegion(i) || !okSearch(i)) continue;
      c.all++;
      c[statusKey(i.status) ?? 'none']++;
    }
    return c;
  }, [items, sphere, region, term]);

  const sphereCounts = useMemo(() => {
    const c = new Map<string, number>();
    let all = 0;
    for (const i of items) {
      if (!okStatus(i) || !okRegion(i) || !okSearch(i)) continue;
      all++;
      if (i.sphere) c.set(i.sphere, (c.get(i.sphere) ?? 0) + 1);
    }
    c.set('all', all);
    return c;
  }, [items, status, region, term]);

  const regionCounts = useMemo(() => {
    const c = new Map<string, number>();
    let all = 0;
    for (const i of items) {
      if (!okStatus(i) || !okSphere(i) || !okSearch(i)) continue;
      all++;
      if (i.region) c.set(i.region, (c.get(i.region) ?? 0) + 1);
    }
    c.set('Все', all);
    return c;
  }, [items, status, sphere, term]);

  const filtered = useMemo(
    () => items.filter((i) => okStatus(i) && okSphere(i) && okRegion(i) && okSearch(i)),
    [items, status, sphere, region, term],
  );

  const opened = openId ? items.find((i) => i.id === openId) ?? null : null;

  return (
    <div className="max-w-[1260px] mx-auto px-6 sm:px-10 py-7 overflow-x-clip">
      <section className="mb-6">
        <h1 className="font-display text-[28px] mb-1.5">Участники курса Web3nity</h1>
        <p className="text-text2 text-sm">
          Познакомьтесь с другими студентами, найдите партнёров, клиентов или единомышленников.
          Напишите любому напрямую в Telegram.
        </p>
        <div className="flex flex-wrap gap-4 mt-2.5 text-[13px] text-text3">
          <StatBadge color="bg-accent" label={`${stats.total} участник${plural(stats.total)}`} />
          <StatBadge color="bg-green" label={`${stats.countries} стран`} />
          <StatBadge color="bg-blue" label={`${stats.spheres} сфер`} />
        </div>
      </section>

      {recommendations.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setRecsOpen(true)}
            className="px-4 py-2.5 rounded-sm bg-accent text-white text-[13px] font-semibold hover:bg-accent-dark transition-colors"
          >
            Ваши рекомендации · {recommendations.length}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3.5">
        <h2 className="font-display text-[20px]">Все участники</h2>
        <span className="text-[12px] text-text3">{filtered.length} чел.</span>
      </div>

      <div className="relative mb-3.5">
        <SearchIcon />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени, сфере, городу..."
          className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-surface border border-line rounded focus:border-accent focus:ring-2 focus:ring-accent-light outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <FilterGroup label="Статус">
          {STATUS_OPTS.filter(
            // «Без статуса» прячем, когда таких нет — чтобы не мозолил пустым нулём
            (o) => o.key !== 'none' || statusCounts.none > 0,
          ).map((o) => (
            <Chip key={o.key} active={status === o.key} onClick={() => setStatus(o.key)}>
              {o.label}
              <span className="ml-1 opacity-50">{statusCounts[o.key]}</span>
            </Chip>
          ))}
        </FilterGroup>

        {spheres.length > 1 && (
          <FilterGroup label="Сфера">
            {spheres.map((s) => (
              <Chip key={s} active={sphere === s} onClick={() => setSphere(s)}>
                {s === 'all' ? 'Все' : s}
                <span className="ml-1 opacity-50">{sphereCounts.get(s) ?? 0}</span>
              </Chip>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="Регион">
          {REGION_OPTS.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>
              {r}
              <span className="ml-1 opacity-50">{regionCounts.get(r) ?? 0}</span>
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text3">
          <div className="text-3xl mb-2">·</div>
          <h3 className="text-[15px] text-text2 mb-1">Никого не нашли</h3>
          <p className="text-[13px]">Попробуйте изменить фильтры</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s, idx) => (
            <li key={s.id}>
              <Card item={s} index={idx} isMe={!!myId && s.id === myId} onOpen={() => setOpenId(s.id)} />
            </li>
          ))}
        </ul>
      )}

      {opened && <Modal item={opened} onClose={() => setOpenId(null)} />}
      {recsOpen && (
        <RecsModal recommendations={recommendations} onClose={() => setRecsOpen(false)} />
      )}
    </div>
  );
}

function RecsModal({
  recommendations,
  onClose,
}: {
  recommendations: { item: DirItem; reason: string | null }[];
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/35 backdrop-blur-[4px] z-40 flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-lg w-[560px] max-w-full max-h-[85vh] overflow-y-auto shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 bg-surface-hover w-7 h-7 rounded-full text-text2 text-[13px] flex items-center justify-center hover:bg-line"
        >
          ✕
        </button>
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-display text-[20px] mb-0.5">Ваши рекомендации</h2>
          <p className="text-[13px] text-text2">
            Участники курса, с которыми вам стоит познакомиться.
          </p>
        </div>
        <ul className="px-6 py-4 space-y-3">
          {recommendations.map(({ item, reason }) => (
            <li key={item.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Avatar item={item} size={48} radius={12} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] truncate">{item.name}</div>
                  <div className="text-[12px] text-text3 truncate">
                    {[item.niche, item.city || item.country].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {reason && (
                    <div className="mt-2.5 flex gap-2 rounded bg-accent-light px-3 py-2">
                      <span className="text-accent shrink-0 mt-px">›</span>
                      <p className="text-[13px] text-tag-text leading-snug">{reason}</p>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {item.telegram && (
                      <a
                        href={`https://t.me/${item.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] px-3 py-1.5 rounded-full bg-accent text-white hover:bg-accent-dark"
                      >
                        Написать
                      </a>
                    )}
                    <Link
                      href={`/students/${item.slug}`}
                      className="text-[12px] px-3 py-1.5 rounded-full border border-line text-text2 hover:border-accent hover:text-accent"
                    >
                      Открыть профиль
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatBadge({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-[11px] text-text3 uppercase tracking-[.5px] font-medium mr-0.5 shrink-0 pt-1.5">
        {label}:
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors whitespace-nowrap ${
        active
          ? 'bg-ink text-white border-ink'
          : 'bg-surface text-text2 border-line hover:border-text3'
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Card({ item, index, isMe, onOpen }: { item: DirItem; index: number; isMe: boolean; onOpen: () => void }) {
  const color = statusColor(item.status);
  return (
    <button
      onClick={onOpen}
      className={`w3n-card-anim text-left w-full bg-surface border rounded p-[18px] hover:shadow-md hover:-translate-y-0.5 transition-all ${
        isMe ? 'border-accent' : 'border-line'
      }`}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div className="flex gap-3 mb-2.5">
        <Avatar item={item} size={40} radius={10} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[14px] truncate flex items-center gap-1.5">
            {item.name}
            {isMe && (
              <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-white">
                это вы
              </span>
            )}
          </div>
          <div className="text-[11px] text-text3 flex items-center gap-1 truncate">
            <PinIcon />
            <span className="truncate">
              {[item.city, item.country].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
        </div>
      </div>
      {item.bio && (
        <p className="text-[12px] text-text2 leading-[1.5] mb-2.5 line-clamp-2">{item.bio}</p>
      )}
      {item.sphere && (
        <div className="mb-2.5">
          <span className="inline-block max-w-full truncate align-bottom px-2 py-0.5 rounded-full text-[10px] font-medium bg-tag-bg text-tag-text">
            {item.sphere}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center pt-2.5 border-t border-line-light">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${color.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
          {statusText(item.status)}
        </div>
        {item.telegram ? (
          <a
            onClick={(e) => e.stopPropagation()}
            href={`https://t.me/${item.telegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-full border border-line bg-transparent text-[11px] text-text2 hover:bg-accent hover:text-white hover:border-accent transition-colors flex items-center gap-1"
          >
            <ChatIcon size={12} />
            Написать
          </a>
        ) : null}
      </div>
    </button>
  );
}

function Avatar({ item, size, radius }: { item: DirItem; size: number; radius: number }) {
  if (item.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={item.avatarUrl}
        alt={item.name}
        width={size}
        height={size}
        className="object-cover flex-shrink-0"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: item.avatarColor,
        fontSize: size * 0.38,
      }}
    >
      {item.name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChatIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function Modal({ item, onClose }: { item: DirItem; onClose: () => void }) {
  const color = statusColor(item.status);
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/35 backdrop-blur-[4px] z-40 flex items-center justify-center p-4"
    >
      <div className="bg-surface rounded-lg w-[500px] max-w-full max-h-[85vh] overflow-y-auto shadow-lg relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 bg-surface-hover w-7 h-7 rounded-full text-text2 text-[13px] flex items-center justify-center hover:bg-line"
        >
          ✕
        </button>
        <div className="px-6 pt-6 flex gap-3.5">
          <Avatar item={item} size={52} radius={13} />
          <div>
            <h2 className="font-display text-[20px] mb-0.5">{item.name}</h2>
            <div className="text-[13px] text-text2">
              {[item.city, item.country].filter(Boolean).join(', ')}
              {item.sphere ? ` · ${item.sphere}` : ''}
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          {item.bio && <Section title="О себе">{item.bio}</Section>}
          {item.goal && <Section title="Цель на курсе">{item.goal}</Section>}
          {item.niche && <Section title="Специализация">{item.niche}</Section>}
          {item.sphere && (
            <div className="mb-4">
              <h4 className="text-[10px] uppercase tracking-[.8px] text-text3 mb-1.5 font-medium">
                Сфера
              </h4>
              <span className="inline-block max-w-full break-words px-3 py-1 rounded-full bg-tag-bg text-tag-text text-[12px]">
                {item.sphere}
              </span>
            </div>
          )}
          <div className="mb-4">
            <h4 className="text-[10px] uppercase tracking-[.8px] text-text3 mb-1.5 font-medium">
              Статус
            </h4>
            <div className={`flex items-center gap-1.5 text-[13px] ${color.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
              {statusText(item.status)}
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-line-light">
            {item.telegram ? (
              <a
                href={`https://t.me/${item.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 rounded-sm bg-accent text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-dark"
              >
                <ChatIcon size={15} />
                Написать в Telegram
              </a>
            ) : (
              <span className="flex-1 px-4 py-2.5 rounded-sm bg-surface-hover text-text3 text-[13px] text-center">
                Telegram не указан
              </span>
            )}
            <Link
              href={`/students/${item.slug}`}
              className="px-4 py-2.5 rounded-sm bg-surface border border-line text-[13px] text-text2 hover:bg-surface-hover"
            >
              Открыть
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-[10px] uppercase tracking-[.8px] text-text3 mb-1.5 font-medium">
        {title}
      </h4>
      <p className="text-[13px] text-text2 leading-[1.6]">{children}</p>
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'ов';
  if (mod10 === 1) return '';
  if (mod10 >= 2 && mod10 <= 4) return 'а';
  return 'ов';
}
