import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth';
import { toProjectCard } from '@/lib/catalog';
import { studentSlug } from '@/lib/db';
import { projectsOf } from '@/lib/queries';
import { ProjectPreview, ProjectTags } from '@/lib/ui';
import { deleteProject, toggleProject } from './actions';
import { ConfirmButton } from './confirm-button';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Мой профиль' };

export default async function CabinetPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await requireStudent();
  const { saved } = await searchParams;
  const hasProfile = me.is_published;
  const works = await projectsOf(me.id, true);

  return (
    <>
      <div className="pagehead cabinet-head">
        <div>
          <div className="eyebrow">Личный кабинет</div>
          <h1>
            Мой <span className="green">профиль</span>
          </h1>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button className="linkbtn" type="submit">
            Выйти
          </button>
        </form>
      </div>
      {saved === 'profile' ? (
        <p className="notice" role="status">
          Анкета сохранена.
        </p>
      ) : null}
      <div className="routes">
        <section className="route">
          <h2>{hasProfile ? 'Моя анкета' : 'Расскажите о себе'}</h2>
          <p>
            {hasProfile
              ? 'Анкета уже есть на платформе. Вы можете её обновить.'
              : 'Создайте анкету, чтобы другие ученики могли познакомиться с вами.'}
          </p>
          <Link className="btn" href="/profile/edit">
            {hasProfile ? 'Редактировать анкету' : 'Создать профиль'} →
          </Link>
          {hasProfile ? (
            <Link className="back" style={{ margin: '18px 0 0' }} href={`/s/${studentSlug(me)}`}>
              Посмотреть анкету →
            </Link>
          ) : null}
        </section>
        <section className="route">
          <h2>Мои проекты</h2>
          <p>Добавляйте новые проекты и обновляйте результаты.</p>
          <Link className="btn action-blue" href="/profile/projects/new">
            Добавить проект →
          </Link>
        </section>
      </div>
      {works.length ? (
        <div className="grid cabinet-cards">
          {works.map((w) => {
            const p = toProjectCard(w, me);
            return (
              <article className="card" key={w.id}>
                <ProjectPreview p={p} />
                <ProjectTags p={p} />
                <h3>{w.title}</h3>
                {w.description ? <p className="clamp">{w.description}</p> : null}
                {w.hidden_by_admin ? <p>Проект скрыт организатором.</p> : null}
                <div className="actions">
                  <Link href={`/w/${w.id}`}>Открыть</Link>
                  <Link href={`/profile/projects/${w.id}`}>Редактировать</Link>
                  <form action={toggleProject}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="next" value={String(!w.is_published)} />
                    <button className="linkbtn" type="submit">
                      {w.is_published ? 'Скрыть' : 'Показать'}
                    </button>
                  </form>
                  <form action={deleteProject}>
                    <input type="hidden" name="id" value={w.id} />
                    <ConfirmButton message={`Удалить проект «${w.title}»? Это нельзя отменить.`}>Удалить</ConfirmButton>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
