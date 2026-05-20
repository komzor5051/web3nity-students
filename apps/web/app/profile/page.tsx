import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentStudent, botUsername } from '@/lib/auth';
import { studentSlug } from '@/lib/db';
import { Avatar } from '@/lib/components';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await getCurrentStudent().catch(() => null);
  if (!me) redirect('/login');

  const slug = studentSlug(me);
  const bot = botUsername();

  const rows: Array<[string, string | number | null]> = [
    ['Имя', me.display_name],
    ['Ниша', me.niche],
    ['Город', me.city],
    ['Страна', me.country],
    ['Возраст', me.age],
    ['Био', me.bio],
    ['Цель', me.goal],
    ['Экспертиза', me.expertise],
    ['Хобби', me.hobbies],
    ['Telegram', me.telegram_username ? '@' + me.telegram_username : null],
    ['Статус', statusLabel(me.status)],
    ['На витрине', me.status === undefined ? '—' : me.is_published ? 'Да' : 'Нет'],
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-start gap-4 mb-8">
        <Avatar name={me.display_name} url={me.avatar_url} />
        <div className="min-w-0">
          <h1 className="font-display text-2xl">{me.display_name}</h1>
          <div className="text-text2 text-sm">
            {[me.niche, me.city || me.country].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Link
              href={`/students/${slug}`}
              className="text-xs px-3 py-1 rounded-full border border-line hover:border-accent hover:text-accent"
            >
              Открыть публичную страницу
            </Link>
            {bot && (
              <a
                href={`https://t.me/${bot}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-full bg-accent text-white hover:bg-accent-dark"
              >
                Редактировать в боте
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`grid grid-cols-[140px_1fr] gap-4 px-5 py-3 text-sm ${
              i !== rows.length - 1 ? 'border-b border-line-light' : ''
            }`}
          >
            <div className="text-text3 uppercase tracking-wider text-[11px] pt-0.5">{label}</div>
            <div className="text-ink whitespace-pre-wrap break-words">
              {value ?? <span className="text-text3">—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-surface-hover rounded p-4 text-text2 text-[13px] leading-relaxed">
        <b className="text-ink">Как редактировать профиль:</b> все изменения через бота —
        команда <code>/edit</code> в Telegram. Бот хранит сессию и сам обновит данные на сайте.
      </div>
    </div>
  );
}

function statusLabel(s: string | null): string | null {
  if (s === 'looking_for_clients') return 'Ищу клиентов';
  if (s === 'looking_for_partners') return 'Ищу партнёров';
  if (s === 'just_learning') return 'Учусь';
  return null;
}
