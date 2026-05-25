'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Avatar } from '@/lib/components';
import { updateAvatar, type ActionResult } from './actions';

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs px-3 py-1 rounded-full border border-line hover:border-accent hover:text-accent disabled:opacity-60"
    >
      {pending ? 'Загружаем…' : 'Загрузить фото'}
    </button>
  );
}

export default function AvatarUploader({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateAvatar,
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative group rounded-sm overflow-hidden"
        title="Сменить фото"
      >
        <Avatar name={name} url={url} />
        <span className="absolute inset-0 bg-black/40 text-white text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          Сменить
        </span>
      </button>
      <div className="flex flex-col gap-1.5">
        <input
          ref={fileRef}
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <UploadButton />
        {state?.ok === false && (
          <span className="text-red-600 text-[11px]">{state.error}</span>
        )}
        {state?.ok === true && (
          <span className="text-green text-[11px]">Фото обновлено</span>
        )}
        <span className="text-[11px] text-text3">JPG / PNG / WebP, до 5 МБ</span>
      </div>
    </form>
  );
}
