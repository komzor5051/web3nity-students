'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { WorkRow } from '@/lib/db';
import { createWork, deleteWork, toggleWork, type ActionResult } from './actions';

const FIELD =
  'w-full bg-bg border border-line rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent';
const LABEL = 'text-text3 uppercase tracking-wider text-[11px] mb-1 block';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-60"
    >
      {pending ? 'Загружаем…' : 'Добавить проект'}
    </button>
  );
}

function WorkRowItem({ work }: { work: WorkRow }) {
  const images = work.media.filter((m) => m.type === 'image');
  return (
    <div className="border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-ink">{work.title}</div>
          {work.description && (
            <p className="text-text2 text-sm mt-1 line-clamp-2">{work.description}</p>
          )}
          {work.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {work.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-tag-bg text-tag-text"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${
            work.is_published ? 'bg-green-bg text-green' : 'bg-tag-bg text-text3'
          }`}
        >
          {work.is_published ? 'на витрине' : 'скрыт'}
        </span>
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {images.slice(0, 4).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.url}
              src={m.url}
              alt=""
              className="w-16 h-16 object-cover rounded border border-line"
            />
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-3">
        <form action={toggleWork}>
          <input type="hidden" name="workId" value={work.id} />
          <input type="hidden" name="next" value={String(!work.is_published)} />
          <button className="text-xs text-text2 underline underline-offset-2 hover:text-accent">
            {work.is_published ? 'Скрыть с витрины' : 'Показать на витрине'}
          </button>
        </form>
        <form
          action={deleteWork}
          onSubmit={(e) => {
            if (!confirm(`Удалить проект «${work.title}»?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="workId" value={work.id} />
          <button className="text-xs text-text3 underline underline-offset-2 hover:text-red-600">
            Удалить
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WorksSection({ works }: { works: WorkRow[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createWork, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="bg-surface border border-line rounded-lg p-6">
      <h2 className="font-display text-xl mb-1">Мои проекты</h2>
      <p className="text-text3 text-sm mb-5">
        Добавляйте кейсы и работы — они появятся на вашей публичной странице.
      </p>

      {works.length > 0 ? (
        <div className="space-y-3 mb-6">
          {works.map((w) => (
            <WorkRowItem key={w.id} work={w} />
          ))}
        </div>
      ) : (
        <p className="text-text3 text-sm mb-6">Пока ни одного проекта.</p>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="border-t border-line-light pt-5 space-y-4"
      >
        <h3 className="font-medium text-ink text-sm">Новый проект</h3>
        <div>
          <label className={LABEL}>Название</label>
          <input name="title" required className={FIELD} placeholder="Чат-бот для записи клиентов" />
        </div>
        <div>
          <label className={LABEL}>Описание</label>
          <textarea
            name="description"
            rows={3}
            className={FIELD}
            placeholder="Что сделали, какой результат, какие инструменты."
          />
        </div>
        <div>
          <label className={LABEL}>Теги через запятую</label>
          <input name="tags" className={FIELD} placeholder="n8n, телеграм-бот, crm" />
        </div>
        <div>
          <label className={LABEL}>Файлы — скриншоты, фото (до 15 МБ каждый)</label>
          <input
            name="files"
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            className="block w-full text-sm text-text2 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-accent-light file:text-accent file:text-sm file:cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-3">
          <AddButton />
          {state?.ok === true && <span className="text-green text-sm">Проект добавлен</span>}
          {state?.ok === false && <span className="text-red-600 text-sm">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
