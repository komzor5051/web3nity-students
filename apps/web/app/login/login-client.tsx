'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type StartResp = { token: string; deepLink: string };

export default function LoginClient() {
  const [data, setData] = useState<StartResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingFailed, setPollingFailed] = useState(false);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetch('/api/auth/start', { method: 'POST' })
      .then((r) => r.json())
      .then((r: StartResp | { error: string }) => {
        if ('error' in r) setError(r.error);
        else setData(r);
      })
      .catch(() => setError('Не удалось создать ссылку для входа.'));
  }, []);

  useEffect(() => {
    if (!data?.token) return;
    let stopped = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/auth/status?token=${encodeURIComponent(data.token)}`, {
          cache: 'no-store',
        });
        const j = (await r.json()) as { status: 'pending' | 'confirmed' | 'expired' };
        if (stopped) return;
        if (j.status === 'confirmed') {
          router.replace('/profile');
          router.refresh();
          return;
        }
        if (j.status === 'expired') {
          setPollingFailed(true);
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

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  if (pollingFailed) {
    return (
      <div className="space-y-3">
        <p className="text-text2 text-sm">Ссылка устарела. Попробуйте ещё раз.</p>
        <button
          onClick={() => location.reload()}
          className="px-4 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-dark"
        >
          Создать новую ссылку
        </button>
      </div>
    );
  }

  if (!data) return <p className="text-text3 text-sm">Создаём ссылку…</p>;

  return (
    <div className="space-y-4">
      <a
        href={data.deepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-semibold text-sm hover:bg-accent-dark transition-colors w-full"
      >
        Открыть Telegram
      </a>
      <p className="text-text3 text-xs">
        После того как вы нажмёте <b>«Запустить»</b> в боте — эта страница автоматически перейдёт в личный кабинет.
      </p>
    </div>
  );
}
