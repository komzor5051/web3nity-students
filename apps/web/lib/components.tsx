import type { StudentRow } from './db';

export function Avatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-sm border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="rounded-sm border border-line bg-line/50 flex items-center justify-center font-bold text-cream"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || '?'}
    </div>
  );
}

export function StatusPill({ status }: { status: NonNullable<StudentRow['status']> }) {
  const label =
    status === 'looking_for_clients'
      ? 'ищу клиентов'
      : status === 'looking_for_partners'
        ? 'ищу партнёров'
        : 'учусь';
  return (
    <span className="text-xs uppercase tracking-wider px-2 py-1 border border-accent text-accent">
      {label}
    </span>
  );
}
