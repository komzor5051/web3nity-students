import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { KIND_LABEL, toProjectCard } from '@/lib/catalog';
import { studentSlug } from '@/lib/db';
import { findProject, findStudentById } from '@/lib/queries';
import { ProjectPreview, ProjectTags } from '@/lib/ui';
import { cleanBio } from '@/lib/text';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  await requireStudent();
  const w = await findProject((await params).id);
  return { title: w?.title ?? 'Проект' };
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

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStudent();
  const w = await findProject((await params).id);
  if (!w) notFound();
  const author = await findStudentById(w.student_id);
  const own = w.student_id === me.id;
  // Скрытый проект или проект скрытой анкеты видит только автор.
  if (!author || (!own && (!w.is_published || w.hidden_by_admin || !author.is_published))) notFound();

  const p = toProjectCard(w, author);

  return (
    <>
      <Link className="back" href="/projects">
        ← Все проекты
      </Link>
      <div className="split detail">
        <section>
          <div className="eyebrow">Проект ученика{w.kind ? ` · ${KIND_LABEL[w.kind]}` : ''}</div>
          <h1>{w.title}</h1>
          <ProjectTags p={p} />
          <Field title="Какую задачу решает и для кого" text={cleanBio(w.description)} />
          <Field title="Что уже получилось реализовать" text={w.features} />
          <Field title="Какая помощь или обратная связь нужна" text={w.feedback_request} />
          <div className="field">
            <strong>Автор</strong>
            {author.is_published ? <Link href={`/s/${studentSlug(author)}`}>{author.display_name} →</Link> : <p>{author.display_name}</p>}
          </div>
          {w.hidden_by_admin ? <p className="nolink">Проект скрыт организатором и виден только вам.</p> : null}
          <div className="actions">
            {w.live_url ? (
              <a className="btn" href={w.live_url} target="_blank" rel="noopener noreferrer">
                Открыть проект ↗
              </a>
            ) : null}
            {w.repo_url ? (
              <a className="btn secondary" href={w.repo_url} target="_blank" rel="noopener noreferrer">
                Код проекта ↗
              </a>
            ) : null}
            {own ? (
              <Link className="btn action-blue" href={`/profile/projects/${w.id}`}>
                Редактировать проект →
              </Link>
            ) : null}
          </div>
          {!w.live_url ? <p className="nolink">Ссылка на проект не добавлена.</p> : null}
        </section>
        <aside className="panel">
          <ProjectPreview p={p} />
          <p className="location">
            {p.imageUrl ? 'Скриншот проекта' : 'Условный макет: скриншот не добавлен'}
            {w.live_url ? ` · ${hostLabel(w.live_url)}` : ''}
          </p>
        </aside>
      </div>
    </>
  );
}
