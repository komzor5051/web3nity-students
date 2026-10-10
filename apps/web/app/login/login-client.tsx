'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type StartResp = { token: string; deepLink: string };
type Status = 'pending' | 'confirmed' | 'expired' | 'denied';

export default function LoginClient({ initiallyDenied }: { initiallyDenied: boolean }) {
  const [data, setData] = useState<StartResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(initiallyDenied ? 'denied' : null);
  const [opened, setOpened] = useState(false);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || initiallyDenied) return;
    startedRef.current = true;
    fetch('/api/auth/start', { method: 'POST' })
      .then((r) => r.json())
      .then((r: StartResp | { error: string }) => {
        if ('error' in r) setError(r.error);
        else setData(r);
      })
      .catch(() => setError('Не удалось подготовить вход. Обновите страницу.'));
  }, [initiallyDenied]);

  useEffect(() => {
    if (!data?.token) return;
    let stopped = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/auth/status?token=${encodeURIComponent(data.token)}`, { cache: 'no-store' });
        const j = (await r.json()) as { status: Status };
        if (stopped) return;
        if (j.status === 'confirmed') {
          router.replace('/');
          router.refresh();
          return;
        }
        if (j.status === 'expired' || j.status === 'denied') {
          setStatus(j.status);
          return;
        }
        setTimeout(poll, 1500);
      } catch {
        if (!stopped) setTimeout(poll, 3000);
      }
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [data?.token, router]);

  if (status === 'denied') {
    return (
      <div role="alert">
        <h2>Доступ только для учеников</h2>
        <p className="demo">
          Этот Telegram-аккаунт не найден среди участников практикума. Если вы учитесь на практикуме, войдите с
          аккаунта, которым состоите в чате курса, или напишите организатору.
        </p>
        <button className="btn" type="button" onClick={() => (location.href = '/login')}>
          Войти с другого аккаунта →
        </button>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div role="alert">
        <p className="demo">Ссылка для входа устарела. Создайте новую.</p>
        <button className="btn" type="button" onClick={() => location.reload()}>
          Войти через Telegram →
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <>
      {data ? (
        <a className="btn" href={data.deepLink} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
          Войти через Telegram →
        </a>
      ) : (
        <button className="btn" type="button" disabled aria-busy="true">
          Готовим вход…
        </button>
      )}
      <p className="demo" role="status">
        {opened
          ? 'В Telegram нажмите «Запустить» в боте. Эта страница откроет платформу сама, или нажмите кнопку в ответе бота.'
          : 'Вход подтверждает бот практикума. Платформа открыта только ученикам.'}
      </p>
    </>
  );
}
