import Link from 'next/link';
import type { WorkRow } from '@/lib/db';
import { KIND_LABEL, KIND_ORDER, projectImageUrl } from '@/lib/catalog';
import { saveProject } from '../actions';
import { ActionForm, SubmitButton } from '../action-form';

export function ProjectForm({ work }: { work?: WorkRow }) {
  const cover = work ? projectImageUrl(work) : null;
  return (
    <div className="form">
      <Link className="back" href={work ? `/w/${work.id}` : '/projects'}>
        {work ? '← К проекту' : '← Все проекты'}
      </Link>
      <div className="eyebrow">Мой проект</div>
      <h1>
        {work ? 'Обновите ' : 'Поделитесь '}
        <span className="blue">результатом</span>
      </h1>
      <p className="lead">Расскажите, что вы создаёте и какую задачу решает ваш инструмент.</p>
      <ActionForm action={saveProject} id="add-form">
        {work ? <input type="hidden" name="id" value={work.id} /> : null}
        <div className="form-group">
          <label htmlFor="title">Название проекта</label>
          <input id="title" name="title" required maxLength={160} defaultValue={work?.title ?? ''} placeholder="Например, запись на консультацию" />
        </div>
        <div className="form-group">
          <label htmlFor="description">Какую задачу решает и для кого?</label>
          <textarea id="description" name="description" required maxLength={4000} defaultValue={work?.description ?? ''} />
        </div>
        <div className="form-group">
          <label htmlFor="cover">Обложка или скриншот — необязательно</label>
          <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
          {cover ? <p className="hint">Обложка уже есть. Новый файл заменит её.</p> : null}
        </div>
        <div className="form-group">
          <label htmlFor="kind">Тип инструмента</label>
          <select id="kind" name="kind" defaultValue={work?.kind ?? 'site'}>
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="live_url">Ссылка на проект — необязательно</label>
          <input id="live_url" name="live_url" type="url" maxLength={500} defaultValue={work?.live_url ?? ''} placeholder="https://" />
        </div>
        <div className="form-group">
          <label htmlFor="stage">Состояние проекта</label>
          <select id="stage" name="stage" defaultValue={work?.stage ?? 'in_progress'}>
            <option value="in_progress">В работе</option>
            <option value="done">Готов</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="features">Что уже получилось реализовать — необязательно</label>
          <textarea id="features" name="features" maxLength={4000} defaultValue={work?.features ?? ''} />
        </div>
        <div className="form-group">
          <label htmlFor="feedback_request">Какая помощь или обратная связь нужна — необязательно</label>
          <textarea id="feedback_request" name="feedback_request" maxLength={4000} defaultValue={work?.feedback_request ?? ''} />
        </div>
        <p className="demo">
          Автор добавляется автоматически. Можно опубликовать проект без ссылки. Проект сразу виден ученикам; скрыть его можно в
          кабинете.
        </p>
        <SubmitButton className="btn action-blue" pending="Публикуем…">
          {work ? 'Сохранить проект →' : 'Опубликовать проект →'}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
