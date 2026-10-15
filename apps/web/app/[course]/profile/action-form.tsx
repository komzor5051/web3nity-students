'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from './actions';

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/** Форма на server action: ошибка сервера показывается под кнопкой. */
export function ActionForm({ action, id, children }: { action: Action; id: string; children: React.ReactNode }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, null);
  return (
    <form action={formAction} id={id}>
      {children}
      <p className={state?.ok === false ? 'notice error' : 'notice'} role={state?.ok === false ? 'alert' : 'status'}>
        {state?.ok === false ? state.error : ''}
      </p>
    </form>
  );
}

export function SubmitButton({ children, pending, className = 'btn' }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={busy} aria-busy={busy}>
      {busy ? pending : children}
    </button>
  );
}
