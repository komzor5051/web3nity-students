'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { StudentRow } from '@/lib/db';
import { updateProfile, type ActionResult } from './actions';

const FIELD =
  'w-full bg-bg border border-line rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent';
const LABEL = 'text-text3 uppercase tracking-wider text-[11px] mb-1 block';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-60"
    >
      {pending ? 'Сохраняем…' : 'Сохранить профиль'}
    </button>
  );
}

export default function ProfileEditor({ student }: { student: StudentRow }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={formAction} className="bg-surface border border-line rounded-lg p-6">
      <h2 className="font-display text-xl mb-5">Профиль</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={LABEL}>Имя</label>
          <input name="display_name" defaultValue={student.display_name} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Ниша</label>
          <input name="niche" defaultValue={student.niche ?? ''} className={FIELD} placeholder="например: AI-автоматизация" />
        </div>
        <div>
          <label className={LABEL}>Статус</label>
          <select name="status" defaultValue={student.status ?? ''} className={FIELD}>
            <option value="">— не указан —</option>
            <option value="looking_for_clients">Ищу клиентов</option>
            <option value="looking_for_partners">Ищу партнёров</option>
            <option value="just_learning">Просто учусь</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Город</label>
          <input name="city" defaultValue={student.city ?? ''} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Страна</label>
          <input name="country" defaultValue={student.country ?? ''} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Возраст</label>
          <input
            name="age"
            type="number"
            min={11}
            max={99}
            defaultValue={student.age ?? ''}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Хобби</label>
          <input name="hobbies" defaultValue={student.hobbies ?? ''} className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Био</label>
          <textarea name="bio" defaultValue={student.bio ?? ''} rows={3} className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Цель обучения</label>
          <textarea name="goal" defaultValue={student.goal ?? ''} rows={2} className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Экспертиза</label>
          <textarea
            name="expertise"
            defaultValue={student.expertise ?? ''}
            rows={2}
            className={FIELD}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mt-5 text-sm text-text2 cursor-pointer">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={student.is_published}
          className="w-4 h-4 accent-accent"
        />
        Показывать профиль на витрине
      </label>

      <div className="mt-5 flex items-center gap-3">
        <SaveButton />
        {state?.ok === true && <span className="text-green text-sm">Сохранено</span>}
        {state?.ok === false && <span className="text-red-600 text-sm">{state.error}</span>}
      </div>
    </form>
  );
}
