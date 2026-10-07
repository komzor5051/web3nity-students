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
        className="rounded-[24px] border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <div
      className="rounded-[24px] border border-line bg-accent-light flex items-center justify-center font-display font-bold text-accent-dark"
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
    <span className="inline-flex rounded-sm bg-accent-light text-accent-dark font-mono text-[9px] uppercase tracking-[.08em] px-2.5 py-1.5">
      {label}
    </span>
  );
}
