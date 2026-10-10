import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { toProjectCard, toStudentCard } from '@/lib/catalog';
import { findStudentBySlug, projectsOf } from '@/lib/queries';
import { cleanBio } from '@/lib/text';
import { Avatar, ProjectCard, StatusTags } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // Имя в заголовке вкладки — только тому, кто уже прошёл проверку доступа.
  const me = await requireStudent();
  const s = me ? await findStudentBySlug((await params).slug) : null;
  return { title: s?.display_name ?? 'Профиль' };
}

function Field({ title, text }: { title: string; text: string | null | undefined }) {
  const t = text?.trim();
  if (!t) return null;
  return (
    <div className="field">
      <strong>{title}</strong>
      <p>{t}</p>
    </div>
  );
}

export default async function StudentPage({ params }: { params: Promise<{ slug: string }> }) {
  const me = await requireStudent();
  const { slug } = await params;
  const s = await findStudentBySlug(slug);
  if (!s) notFound();

  const card = toStudentCard(s);
  const own = s.id === me.id;
  const works = await projectsOf(s.id, own);
  const projects = works.map((w) => toProjectCard(w, s));
  const occupation = [s.niche, s.expertise].map((x) => x?.trim()).filter(Boolean).join('. ');

  return (
    <>
      <Link className="back" href="/students">
        ← Все ученики
      </Link>
      <div className="split detail">
        <section>
          <Avatar name={s.display_name} url={s.avatar_url} />
          <h1>{s.display_name}</h1>
          {card.location || card.sphere ? (
            <p className="lead">{[card.location, card.sphere].filter(Boolean).join(' · ')}</p>
          ) : null}
          {card.statuses.length ? (
            <div className="tags">
              <StatusTags statuses={card.statuses} />
            </div>
          ) : null}
          <Field title="Чем занимаюсь" text={occupation} />
          <Field title="О себе" text={cleanBio(s.bio)} />
          <Field title="Для чего на практикуме и чего ожидаю" text={s.expectations} />
          <Field title="Цель после обучения" text={s.goal} />
          <Field title="Хобби" text={s.hobbies} />
          <div className="actions">
            {card.telegram ? (
              <a className="btn telegram-btn" href={`https://t.me/${card.telegram}`} target="_blank" rel="noopener noreferrer">
                Написать в Telegram ↗
              </a>
            ) : (
              <p className="nolink" style={{ margin: 0 }}>Контакт в Telegram не указан.</p>
            )}
            {own ? (
              <Link className="btn" href="/profile/edit">
                Редактировать анкету →
              </Link>
            ) : null}
          </div>
        </section>
        <aside className="panel">
          <h2>Проекты</h2>
          {projects.length ? (
            projects.map((p) => <ProjectCard key={p.id} p={p} showAuthor={false} />)
          ) : (
            <p>Проектов пока нет.</p>
          )}
        </aside>
      </div>
    </>
  );
}
