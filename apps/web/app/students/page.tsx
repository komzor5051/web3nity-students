import Link from 'next/link';
import { supabase, studentSlug, tbl, type StudentRow } from '@/lib/db';
import { Avatar, StatusPill } from '@/lib/components';

export const revalidate = 60;

interface SearchParams {
  country?: string;
  niche?: string;
  status?: string;
  q?: string;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  let query = supabase
    .from(tbl('students'))
    .select('id,display_name,avatar_url,city,country,niche,bio,status,telegram_username,updated_at')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (params.country) query = query.eq('country', params.country);
  if (params.niche) query = query.eq('niche', params.niche);
  if (params.status) query = query.eq('status', params.status);
  if (params.q) {
    const like = `%${params.q}%`;
    query = query.or(`display_name.ilike.${like},niche.ilike.${like},bio.ilike.${like}`);
  }

  const { data: students, error } = await query;
  if (error) {
    // БД ещё не подключена / недоступна — показываем чистое пустое состояние,
    // а не техническую ошибку. Детали в логах сервера.
    console.error('students query failed:', error.message);
  }

  const list = (students ?? []) as StudentRow[];

  // Собираем словарь стран/ниш для фильтров.
  const countries = uniq(list.map((s) => s.country).filter(Boolean) as string[]);
  const niches = uniq(list.map((s) => s.niche).filter(Boolean) as string[]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">
          Студенты <span className="text-accent">AI-Ассистенты 3.0</span>
        </h1>
        <p className="text-muted mt-3 max-w-xl">
          Профили участников курса Web3nity. Связаться можно напрямую через Telegram.
        </p>
      </div>

      <Filters
        active={params}
        countries={countries}
        niches={niches}
        total={list.length}
      />

      {list.length === 0 ? (
        <p className="text-muted py-16 text-center">
          {hasActiveFilters(params)
            ? 'Ничего не найдено по этим фильтрам.'
            : 'Профили студентов появятся здесь после импорта. Загляни позже.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {list.map((s) => (
            <li key={s.id}>
              <StudentCard s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b, 'ru'));
}

function hasActiveFilters(p: SearchParams): boolean {
  return Boolean(p.q || p.country || p.niche || p.status);
}

function StudentCard({ s }: { s: StudentRow }) {
  const slug = studentSlug(s);
  return (
    <Link
      href={`/students/${slug}`}
      className="block border border-line hover:border-accent transition-colors p-5 h-full"
    >
      <div className="flex items-start gap-4">
        <Avatar name={s.display_name} url={s.avatar_url} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-lg text-cream truncate">{s.display_name}</div>
          <div className="text-sm text-muted truncate">
            {[s.niche, s.city || s.country].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      </div>
      {s.bio && (
        <p className="mt-4 text-sm text-cream/80 line-clamp-3">{s.bio}</p>
      )}
      {s.status && (
        <div className="mt-4">
          <StatusPill status={s.status} />
        </div>
      )}
    </Link>
  );
}

function Filters({
  active,
  countries,
  niches,
  total,
}: {
  active: SearchParams;
  countries: string[];
  niches: string[];
  total: number;
}) {
  return (
    <form action="/students" method="GET" className="border border-line p-4 grid gap-3 md:grid-cols-5">
      <input
        name="q"
        placeholder="Поиск"
        defaultValue={active.q ?? ''}
        className="bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent md:col-span-2"
      />
      <select
        name="country"
        defaultValue={active.country ?? ''}
        className="bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">Все страны</option>
        {countries.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        name="niche"
        defaultValue={active.niche ?? ''}
        className="bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">Все ниши</option>
        {niches.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <select
        name="status"
        defaultValue={active.status ?? ''}
        className="bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-accent"
      >
        <option value="">Любой статус</option>
        <option value="looking_for_clients">Ищу клиентов</option>
        <option value="looking_for_partners">Ищу партнёров</option>
        <option value="just_learning">Учусь</option>
      </select>
      <div className="md:col-span-5 flex items-center justify-between text-sm text-muted">
        <span>Найдено: {total}</span>
        <div className="flex gap-3">
          <a href="/students" className="hover:text-cream">Сбросить</a>
          <button type="submit" className="bg-accent text-cream px-4 py-1 uppercase tracking-wider text-xs">
            Применить
          </button>
        </div>
      </div>
    </form>
  );
}
