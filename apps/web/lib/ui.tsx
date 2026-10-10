/**
 * Единый набор карточек платформы. Разметка и классы — из прототипа
 * (styles.css), поэтому каталог, профиль и кабинет выглядят одинаково.
 */
import Link from 'next/link';
import type { StudentStatus } from './db';
import { KIND_LABEL, STAGE_LABEL, STATUS_LABEL, type ProjectCardData, type StudentCardData } from './catalog';

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((p) => p.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return letters || Array.from(name.trim())[0] || '?';
}

export function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="avatar">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  );
}

export function StatusTags({ statuses }: { statuses: StudentStatus[] }) {
  return (
    <>
      {statuses.map((s) => (
        <span key={s} className="tag status-tag">
          {STATUS_LABEL[s]}
        </span>
      ))}
    </>
  );
}

export function StudentCard({ s }: { s: StudentCardData }) {
  const about = s.niche ?? s.about;
  return (
    <article className="card">
      <Avatar name={s.name} url={s.avatarUrl} />
      <div>
        <h3>{s.name}</h3>
        {s.location ? <span className="location">{s.location}</span> : null}
      </div>
      {about ? <p className="clamp">{about}</p> : <p>Анкета пока не заполнена.</p>}
      {s.sphere || s.statuses.length ? (
        <div className="tags">
          {s.sphere ? <span className="tag">{s.sphere}</span> : null}
          <StatusTags statuses={s.statuses} />
        </div>
      ) : null}
      <Link className="cardlink" href={`/s/${s.slug}`}>
        Открыть профиль <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

/**
 * Предпросмотр проекта: скриншот/обложка, если есть. Иначе — условный макет
 * интерфейса с названием и типом, разный для типов инструментов, чтобы
 * карточки не были одинаковыми заглушками.
 */
export function ProjectPreview({ p }: { p: Pick<ProjectCardData, 'title' | 'kind' | 'imageUrl'> }) {
  if (p.imageUrl) {
    return (
      <div className="preview shot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt={`Предпросмотр: ${p.title}`} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="preview" role="img" aria-label="Условный макет проекта: скриншот не добавлен">
      <div className="miniapp">
        {p.kind ? KIND_LABEL[p.kind] : 'Проект'}
        <b>{p.title}</b>
        {p.kind === 'crm' ? (
          <div className="bars">
            <i style={{ height: '35%' }} />
            <i style={{ height: '70%' }} />
            <i style={{ height: '50%' }} />
            <i style={{ height: '90%' }} />
          </div>
        ) : p.kind === 'bot' ? (
          <>
            <div className="miniline short" />
            <div className="miniline" style={{ marginLeft: '30%' }} />
            <div className="miniline short" />
          </>
        ) : (
          <>
            <div className="miniline" />
            <div className="miniline short" />
            <div className="miniline" />
          </>
        )}
      </div>
    </div>
  );
}

export function ProjectTags({ p }: { p: Pick<ProjectCardData, 'kind' | 'stage' | 'hidden'> }) {
  if (!p.kind && !p.stage && !p.hidden) return null;
  return (
    <div className="tags">
      {p.kind ? <span className="tag">{KIND_LABEL[p.kind]}</span> : null}
      {p.stage ? <span className="tag status-tag">{STAGE_LABEL[p.stage]}</span> : null}
      {p.hidden ? <span className="tag hidden-tag">Скрыт</span> : null}
    </div>
  );
}

export function ProjectCard({ p, showAuthor = true }: { p: ProjectCardData; showAuthor?: boolean }) {
  return (
    <article className="card">
      <ProjectPreview p={p} />
      <ProjectTags p={p} />
      <h3>{p.title}</h3>
      {p.description ? <p className="clamp">{p.description}</p> : null}
      {showAuthor ? <span className="location">{p.authorName}</span> : null}
      <Link className="cardlink" href={`/w/${p.id}`}>
        Подробнее о проекте <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
