'use client';

import { useEffect, useMemo, useState } from 'react';
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
  avatarUrl: string | null;
  workCount: number;
};

export type GalleryWork = {
  id: string;
  title: string;
  description: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  screenshotUrl: string | null;
  stack: string[];
  authorId: string;
  authorName: string;
  authorSlug: string;
};

type StatusKey = 'all' | 'learning' | 'cofounder' | 'client' | 'none';

const STATUS_OPTS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'learning', label: 'Учусь' },
  { key: 'cofounder', label: 'Ищу партнёров' },
  { key: 'client', label: 'Ищу клиентов' },
  { key: 'none', label: 'Без статуса' },
];

// Транслитерация кириллицы в латиницу для поиска без привязки к языку ввода:
// «Ханна» и «Hanna» обе нормализуются к «hanna». Латиница остаётся как есть,
// поэтому совпадение ловится в обе стороны.
const CYR_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'e', є: 'e',
  ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ў: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

function normalizeSearch(s: string): string {
  let out = '';
  for (const ch of s.trim().toLowerCase()) out += CYR_LAT[ch] ?? ch;
  return out;
}

function statusKey(s: DirItem['status']): 'learning' | 'cofounder' | 'client' | null {
  if (s === 'just_learning') return 'learning';
  if (s === 'looking_for_partners') return 'cofounder';
  if (s === 'looking_for_clients') return 'client';
  return null;
}

function statusText(s: DirItem['status']): string | null {
  if (s === 'just_learning') return 'Учусь';
  if (s === 'looking_for_partners') return 'Ищу партнёров';
  if (s === 'looking_for_clients') return 'Ищу клиентов';
  return null;
}

/** Домен без схемы и www — подпись к ссылке на работу. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Насколько профиль наполнен. По этому порядку идут карточки: человек с
 * работами и рассказом о себе полезнее пустой строки с одним именем, и
 * первый экран должен показывать именно его.
 */
function fullness(i: DirItem): number {
  return i.workCount * 100 + (i.bio ? 10 : 0) + (i.city || i.country ? 3 : 0) + (i.sphere ? 2 : 0);
}

/** У профиля есть что показать в карточке, кроме имени. */
function hasContent(i: DirItem): boolean {
  return i.workCount > 0 || Boolean(i.bio);
}

export default function Directory({
  items,
  works,
  myId,
  recommendations,
}: {
  items: DirItem[];
  works: GalleryWork[];
  myId: string | null;
  recommendations: { item: DirItem; reason: string | null }[];
}) {
  const [status, setStatus] = useState<StatusKey>('all');
  const [sphere, setSphere] = useState<string>('all');
  const [region, setRegion] = useState<string>('Все');
  const [q, setQ] = useState<string>('');
  const [onlyWithWorks, setOnlyWithWorks] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [recsOpen, setRecsOpen] = useState(false);
  const [showAllWorks, setShowAllWorks] = useState(false);

  useEffect(() => {
    if (!openId && !recsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenId(null);
        setRecsOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openId, recsOpen]);

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
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
      .map(([s]) => s);
    return ['all', ...shared];
  }, [items]);

  const stats = useMemo(() => {
    const countries = new Set(items.map((i) => i.country).filter(Boolean) as string[]);
    return { total: items.length, countries: countries.size, works: works.length };
  }, [items, works]);

  const term = normalizeSearch(q);

  const okStatus = (i: DirItem) => {
    if (status === 'all') return true;
    const k = statusKey(i.status);
    return status === 'none' ? k === null : k === status;
  };
  const okSphere = (i: DirItem) => sphere === 'all' || i.sphere === sphere;
  const okRegion = (i: DirItem) => region === 'Все' || i.region === region;
  const okSearch = (i: DirItem) => {
    if (!term) return true;
    const hay = normalizeSearch(
      [i.name, i.niche, i.sphere, i.city, i.country, i.bio, i.telegram].filter(Boolean).join(' '),
    );
    return hay.includes(term);
  };
  const okWorks = (i: DirItem) => !onlyWithWorks || i.workCount > 0;

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
    () =>
      items
        .filter((i) => okStatus(i) && okSphere(i) && okRegion(i) && okSearch(i) && okWorks(i))
        .sort((a, b) => fullness(b) - fullness(a) || a.name.localeCompare(b.name, 'ru')),
    [items, status, sphere, region, term, onlyWithWorks],
  );

  // Профили без работ и без рассказа о себе — отдельным компактным списком.
  // Карточка из одного имени и прочерков занимает столько же места, сколько
  // содержательная, и первый экран превращается в стену пустых плашек.
  const rich = filtered.filter(hasContent);
  const plain = filtered.filter((i) => !hasContent(i));

  // Статусов в импортированных данных нет — показывать фильтр, у которого
  // единственное непустое значение «Без статуса», незачем.
  const showStatusFilter = statusCounts.all > statusCounts.none;

  const opened = openId ? items.find((i) => i.id === openId) ?? null : null;
  const visibleWorks = showAllWorks ? works : works.slice(0, 6);
  const hasFilters = status !== 'all' || sphere !== 'all' || region !== 'Все' || q || onlyWithWorks;

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white vibe-grid vibe-grain">
        <div className="absolute -right-16 top-14 h-64 w-64 rotate-12 border-[44px] border-accent/90 rounded-[36px] opacity-80" aria-hidden="true" />
        <div className="relative max-w-[1320px] mx-auto px-5 sm:px-10 py-16 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-14 lg:gap-20 items-end">
            <div>
              <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[.14em] text-accent mb-6">От идеи до первой ссылки</p>
              <h1 className="font-display max-w-[880px] text-[36px] sm:text-[56px] lg:text-[72px] leading-[.98] tracking-[-.055em] text-balance">
                Сделано учениками. Уже работает.
              </h1>
              <p className="max-w-[650px] text-white/60 text-[15px] sm:text-[17px] leading-relaxed mt-7 text-pretty">
                Живая витрина проектов курса по вайб-кодингу. Открывайте сайты, находите людей из своей сферы и пишите авторам напрямую.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <a href="#works" className="inline-flex items-center gap-3 rounded-sm bg-accent text-ink px-5 py-3 text-[13px] font-extrabold hover:bg-white">
                  Смотреть проекты <span aria-hidden="true">↓</span>
                </a>
                {recommendations.length > 0 && (
                  <button type="button" onClick={() => setRecsOpen(true)} className="rounded-sm border border-white/20 px-5 py-3 text-[13px] font-semibold hover:border-white hover:bg-white/5">
                    Мои рекомендации · {recommendations.length}
                  </button>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 lg:grid-cols-1 border-t lg:border-t-0 lg:border-l border-white/20 lg:pl-8 pt-7 lg:pt-0 gap-5 lg:gap-7">
              <Metric value={stats.works} label={plural(stats.works, 'работа', 'работы', 'работ')} />
              <Metric value={stats.total} label={plural(stats.total, 'участник', 'участника', 'участников')} />
              <Metric value={stats.countries} label={plural(stats.countries, 'страна', 'страны', 'стран')} />
            </dl>
          </div>
        </div>
      </section>

      <div className="max-w-[1320px] mx-auto px-5 sm:px-10 py-16 sm:py-24 overflow-x-clip">
        {works.length > 0 && (
          <section id="works" className="scroll-mt-28">
            <SectionHead title="Проекты, которые уже можно открыть" note={`${works.length} запусков`} />
            <ul className="work-showcase-grid">
              {visibleWorks.map((w, idx) => (
                <li key={w.id}>
                  <WorkTile work={w} index={idx} />
                </li>
              ))}
            </ul>
            {works.length > 6 && (
              <div className="mt-10 flex items-center gap-5">
                <button type="button" onClick={() => setShowAllWorks((value) => !value)} className="rounded-sm border border-ink px-5 py-3 text-[12px] font-bold hover:bg-ink hover:text-white">
                  {showAllWorks ? 'Показать главное' : `Показать все ${works.length}`}
                </button>
                <span className="hidden sm:block h-px flex-1 bg-line" />
              </div>
            )}
          </section>
        )}

        <section id="people" className="mt-24 sm:mt-32 scroll-mt-28">
          <SectionHead title="Кто за этим стоит" note={`${filtered.length} из ${items.length}`} />
          <div className="grid lg:grid-cols-[290px_minmax(0,1fr)] gap-10 lg:gap-12 items-start">
            <aside className="lg:sticky lg:top-[94px] rounded-lg bg-surface p-5 sm:p-6 border border-line">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="font-display text-[13px]">Найти человека</h3>
                {hasFilters && (
                  <button type="button" onClick={() => { setStatus('all'); setSphere('all'); setRegion('Все'); setQ(''); setOnlyWithWorks(false); }} className="font-mono text-[10px] text-text3 hover:text-accent">сбросить</button>
                )}
              </div>
              <div className="relative mb-6">
                <SearchIcon />
                <label htmlFor="directory-search" className="sr-only">Поиск по участникам</label>
                <input id="directory-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, сфера, город" className="w-full pl-10 pr-3 py-3 text-[13px] bg-bg border border-line rounded-sm focus:border-accent outline-none" />
              </div>
              <div className="flex flex-col gap-5">
                {showStatusFilter && (
                  <FilterGroup label="Статус">
                    {STATUS_OPTS.filter((o) => o.key === 'all' || statusCounts[o.key] > 0).map((o) => (
                      <Chip key={o.key} active={status === o.key} onClick={() => setStatus(o.key)}>{o.label}<span className="ml-1.5 opacity-45">{statusCounts[o.key]}</span></Chip>
                    ))}
                  </FilterGroup>
                )}
                {spheres.length > 1 && (
                  <FilterGroup label="Сфера">
                    {spheres.map((s) => (
                      <Chip key={s} active={sphere === s} onClick={() => setSphere(s)}>{s === 'all' ? 'Все' : s}<span className="ml-1.5 opacity-45">{sphereCounts.get(s) ?? 0}</span></Chip>
                    ))}
                  </FilterGroup>
                )}
                <FilterGroup label="Регион">
                  {REGION_OPTS.filter((r) => r === 'Все' || (regionCounts.get(r) ?? 0) > 0).map((r) => (
                    <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}<span className="ml-1.5 opacity-45">{regionCounts.get(r) ?? 0}</span></Chip>
                  ))}
                </FilterGroup>
                <label className="flex items-center gap-3 text-[12px] font-semibold cursor-pointer select-none border-t border-line pt-5">
                  <input type="checkbox" checked={onlyWithWorks} onChange={(e) => setOnlyWithWorks(e.target.checked)} className="accent-accent w-4 h-4" />
                  Только с работами
                </label>
              </div>
            </aside>

            <div>
              {filtered.length === 0 ? (
                <div className="border border-line rounded-lg bg-surface py-20 px-6 text-center">
                  <div className="font-display text-[32px] text-accent mb-3" aria-hidden="true">0</div>
                  <h3 className="font-display text-[14px] text-ink mb-2">Совпадений нет</h3>
                  <p className="text-[13px] text-text2">Сбросьте один из фильтров или попробуйте другой запрос.</p>
                </div>
              ) : (
                <>
                  {rich.length > 0 && (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rich.map((s, idx) => (
                        <li key={s.id}>
                          <Card item={s} index={idx} isMe={!!myId && s.id === myId} onOpen={() => setOpenId(s.id)} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {plain.length > 0 && (
                    <div className={rich.length > 0 ? 'mt-12' : ''}>
                      <h3 className="font-mono text-[10px] uppercase tracking-[.1em] text-text3 mb-3">Ещё {plain.length} {plural(plain.length, 'участник', 'участника', 'участников')} заполняют профиль</h3>
                      <ul className="border-t border-line">
                        {plain.map((s) => <PlainRow key={s.id} item={s} isMe={!!myId && s.id === myId} onOpen={() => setOpenId(s.id)} />)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {opened && <Modal item={opened} onClose={() => setOpenId(null)} />}
      {recsOpen && <RecsModal recommendations={recommendations} onClose={() => setRecsOpen(false)} />}
    </>
  );
}

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end border-b border-ink pb-5 mb-8">
      <h2 className="font-display text-[24px] sm:text-[34px] leading-[1.08] tracking-[-.04em] max-w-[760px] text-balance">{title}</h2>
      <span className="font-mono text-[10px] uppercase tracking-[.1em] text-text3">{note}</span>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-[28px] sm:text-[34px] leading-none tabular-nums">{value}</dd>
      <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[.08em] text-white/40 mt-2">{label}</div>
    </div>
  );
}

function WorkTile({ work, index }: { work: GalleryWork; index: number }) {
  const url = work.liveUrl ?? work.repoUrl;
  return (
    <article
      className="vibe-card-anim group flex h-full flex-col"
      style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
    >
      <Link
        href={`/w/${work.id}`}
        className="relative block border border-line bg-surface overflow-hidden rounded group-hover:border-ink"
      >
        <span className="absolute top-3 left-3 z-10 rounded-sm bg-ink/90 text-white px-2 py-1 font-mono text-[9px] tracking-[.08em]">#{String(index + 1).padStart(2, '0')}</span>
        {work.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.screenshotUrl}
            alt={work.title}
            loading="lazy"
            className="work-visual w-full aspect-[16/10] object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="work-visual w-full aspect-[16/10] bg-accent flex items-end justify-start p-5">
            <span className="font-display text-[14px] text-ink text-left break-all max-w-[80%]">
              {url ? hostLabel(url) : 'без ссылки'}
            </span>
          </div>
        )}
      </Link>
      <div className="pt-4 flex flex-col flex-1">
        <Link href={`/w/${work.id}`} className="font-display text-[14px] sm:text-[15px] leading-snug tracking-[-.025em] hover:text-accent text-balance">
          {work.title}
        </Link>
        {work.description && <p className="mt-2 text-[12px] leading-relaxed text-text2 line-clamp-2 text-pretty">{work.description}</p>}
        <div className="mt-auto pt-3 flex items-baseline gap-1.5 text-[11px] text-text2 min-w-0">
          <Link href={`/s/${work.authorSlug}`} className="hover:text-accent shrink-0 truncate max-w-[45%]">
            {work.authorName}
          </Link>
          {url && (
            <>
              <span className="text-text3">·</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={hostLabel(url)}
                className="font-mono text-text3 hover:text-accent truncate text-[10px]"
              >
                {hostLabel(url)} ↗
              </a>
            </>
          )}
        </div>
      </div>
    </article>
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
      className="fixed inset-0 bg-ink/70 backdrop-blur-[7px] z-40 flex items-center justify-center p-4"
      role="presentation"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="recommendations-title" className="bg-surface border border-line rounded-lg w-[600px] max-w-full max-h-[85vh] overflow-y-auto relative">
        <CloseButton onClose={onClose} />
        <div className="px-6 sm:px-8 pt-8 pb-2 pr-14">
          <p className="font-mono text-[9px] uppercase tracking-[.12em] text-accent mb-3">Для вас</p>
          <h2 id="recommendations-title" className="font-display text-[22px] leading-tight mb-2">Ваши рекомендации</h2>
          <p className="text-[13px] text-text2">
            Участники курса, с которыми вам стоит познакомиться.
          </p>
        </div>
        <ul className="px-6 sm:px-8 py-5 pb-8 space-y-3">
          {recommendations.map(({ item, reason }) => (
            <li key={item.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <Avatar item={item} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] truncate">{item.name}</div>
                  <div className="text-[12px] text-text3 truncate">
                    {[item.niche, item.city || item.country].filter(Boolean).join(' · ')}
                  </div>
                  {reason && (
                    <p className="mt-2.5 border-l-2 border-accent pl-3 text-[13px] text-text2 leading-snug">
                      {reason}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {item.telegram && (
                      <a
                        href={`https://t.me/${item.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] px-3 py-2 rounded-sm bg-accent text-ink font-bold hover:bg-accent-dark hover:text-white"
                      >
                        Написать
                      </a>
                    )}
                    <Link
                      href={`/s/${item.slug}`}
                      className="text-[12px] px-3 py-1.5 rounded-sm border border-line text-text2 hover:border-accent hover:text-accent"
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block font-mono text-[9px] text-text3 uppercase tracking-[.1em] font-medium mb-2.5">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar lg:flex-wrap lg:overflow-visible lg:pb-0">
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1.5 rounded-sm text-[11px] border whitespace-nowrap touch-manipulation ${
        active
          ? 'bg-ink text-white border-ink'
          : 'bg-transparent text-text2 border-line hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3 font-mono text-[17px]">⌕</span>
  );
}

function Card({
  item,
  index,
  isMe,
  onOpen,
}: {
  item: DirItem;
  index: number;
  isMe: boolean;
  onOpen: () => void;
}) {
  const place = [item.city, item.country].filter(Boolean).join(', ');
  const status = statusText(item.status);
  return (
    <article
      className={`vibe-card-anim text-left w-full h-full bg-surface border rounded-lg overflow-hidden flex flex-col hover:-translate-y-1 hover:border-ink ${isMe ? 'border-accent' : 'border-line'}`}
      style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
    >
      <div className="h-1.5 bg-accent" />
      <div className="p-5 sm:p-6 flex-1">
        <div className="flex gap-4 items-center">
          <Avatar item={item} size={52} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[13px] leading-snug truncate flex items-center gap-1.5">
              {item.name}
              {isMe && <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-accent text-ink">это вы</span>}
            </div>
            <div className="text-[11px] text-text3 truncate mt-1">
              {[item.sphere, place].filter(Boolean).join(' · ') || (item.telegram ? `@${item.telegram}` : '')}
            </div>
          </div>
        </div>
        {item.bio && <p className="text-[12px] text-text2 leading-[1.65] mt-5 line-clamp-4 text-pretty">{item.bio}</p>}
        <div className="font-mono text-[10px] uppercase tracking-[.06em] text-text3 mt-5">
          {item.workCount > 0 ? `${item.workCount} ${plural(item.workCount, 'работа', 'работы', 'работ')}` : status ?? 'участник курса'}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-line mt-auto">
        <button type="button" onClick={onOpen} className="px-4 py-3.5 text-[11px] font-bold text-left hover:bg-ink hover:text-white">Открыть профиль →</button>
        {item.telegram ? (
          <a
            href={`https://t.me/${item.telegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3.5 text-[11px] text-text2 text-right border-l border-line hover:bg-accent hover:text-ink font-semibold"
          >
            Telegram ↗
          </a>
        ) : <span className="px-4 py-3.5 text-[11px] text-text3 text-right border-l border-line">без контакта</span>}
      </div>
    </article>
  );
}

/** Строка для профиля, у которого пока нет ни работ, ни рассказа о себе. */
function PlainRow({ item, isMe, onOpen }: { item: DirItem; isMe: boolean; onOpen: () => void }) {
  return (
    <li className="border-b border-line hover:bg-surface/50">
      <div className="flex items-center gap-3 py-3 px-1">
        <button onClick={onOpen} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
          <Avatar item={item} size={32} />
          <span className="text-[13px] truncate">
            {item.name}
            {isMe && <span className="ml-2 text-[11px] text-accent">это вы</span>}
          </span>
          {(item.city || item.country) && (
            <span className="text-[12px] text-text3 truncate hidden sm:inline">
              {[item.city, item.country].filter(Boolean).join(', ')}
            </span>
          )}
        </button>
        {item.telegram ? (
          <a
            href={`https://t.me/${item.telegram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] text-text3 hover:text-accent shrink-0"
          >
            @{item.telegram}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Avatar({ item, size }: { item: DirItem; size: number }) {
  if (item.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={item.avatarUrl}
        alt={item.name}
        width={size}
        height={size}
          className="object-cover flex-shrink-0 rounded-[14px]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center bg-accent-light text-accent-dark font-mono font-semibold flex-shrink-0 rounded-[14px]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {item.name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Закрыть"
      className="absolute top-4 right-4 w-9 h-9 rounded-sm text-text3 text-[15px] flex items-center justify-center hover:bg-surface-hover z-10"
    >
      ✕
    </button>
  );
}

function Modal({ item, onClose }: { item: DirItem; onClose: () => void }) {
  const place = [item.city, item.country].filter(Boolean).join(', ');
  const status = statusText(item.status);
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-ink/70 backdrop-blur-[7px] z-40 flex items-center justify-center p-4"
      role="presentation"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="bg-surface border border-line rounded-lg w-[560px] max-w-full max-h-[85vh] overflow-y-auto relative">
        <CloseButton onClose={onClose} />
        <div className="h-2 bg-accent" />
        <div className="px-6 sm:px-8 pt-8 pr-16 flex gap-4 items-center">
          <Avatar item={item} size={60} />
          <div className="min-w-0">
            <h2 id="profile-dialog-title" className="font-display text-[20px] leading-tight truncate">{item.name}</h2>
            <div className="text-[13px] text-text2 truncate">
              {[item.sphere, place].filter(Boolean).join(' · ') ||
                (item.telegram ? `@${item.telegram}` : '')}
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-7">
          {item.bio && <Section title="О себе">{item.bio}</Section>}
          {item.goal && <Section title="Цель обучения">{item.goal}</Section>}
          {item.niche && <Section title="Специализация">{item.niche}</Section>}
          {status && <Section title="Статус">{status}</Section>}
          {item.workCount > 0 && (
            <Section title="Работы">
              {item.workCount} {plural(item.workCount, 'работа', 'работы', 'работ')} — смотрите в профиле
            </Section>
          )}
          {!item.bio && !item.goal && !item.niche && (
            <p className="text-[13px] text-text2 mb-4">
              Участник пока не рассказал о себе. Напишите ему в Telegram — контакт ниже.
            </p>
          )}
          <div className="flex gap-2 pt-4 border-t border-line">
            {item.telegram ? (
              <a
                href={`https://t.me/${item.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-3 rounded-sm bg-accent text-ink text-[12px] font-bold flex items-center justify-center hover:bg-accent-dark hover:text-white"
              >
                Написать в Telegram
              </a>
            ) : (
              <span className="flex-1 px-4 py-2.5 rounded-sm bg-surface-hover text-text3 text-[13px] text-center">
                Telegram не указан
              </span>
            )}
            <Link
              href={`/s/${item.slug}`}
              className="px-4 py-2.5 rounded-sm border border-line text-[13px] text-text2 hover:border-accent hover:text-accent"
            >
              Профиль
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

/** Русское склонение после числа: 1 работа, 2 работы, 5 работ. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
